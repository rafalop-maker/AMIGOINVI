import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const people = [
  "Abuelo Rafa", "Abuela Pepa", "Tío Pepe", "Tía Isabel", "Primo Rafa Felipe",
  "Primo Alberto", "Tío Aurelio", "Tía Benita", "Prima Victoria", "Primo Rafa López",
  "Tita Laura", "Tío Miguel", "Primo Miguel", "Prima Gloria"
];
const pendingGivers = ["Abuelo Rafa", "Abuela Pepa", "Tío Miguel"];
const knownGivers = people.filter((name) => !pendingGivers.includes(name));
const db = getStore("familia-tarruella-amigos-invisibles");
const entryKey = (giver) => `entry-${people.indexOf(giver)}`;
const finalKey = "three-remaining-assignments-v1";
const headers = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers });
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

async function readEntries() {
  const entries=[];
  for(const giver of people) {
    const entry=await db.get(entryKey(giver),{type:"json"});
    if(entry) entries.push(entry);
  }
  return entries;
}
function randomOrder(items) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}
function makeFinalAssignments(entries) {
  const knownEntries=entries.filter((entry)=>knownGivers.includes(entry.giver));
  if(knownEntries.length!==knownGivers.length) return null;
  const selected=knownEntries.map((entry)=>entry.recipient);
  if(selected.some((name)=>!people.includes(name)) || new Set(selected).size!==knownGivers.length) return null;
  const remaining=people.filter((name)=>!selected.includes(name));
  if(remaining.length!==pendingGivers.length) return null;
  for(let attempt=0;attempt<10000;attempt++) {
    const recipients=randomOrder(remaining);
    if(pendingGivers.every((giver,index)=>giver!==recipients[index])) {
      return Object.fromEntries(pendingGivers.map((giver,index)=>[giver,recipients[index]]));
    }
  }
  return null;
}

export default async (request) => {
  if(request.method==="GET") {
    const entries=await readEntries();
    return json({submitted:entries.map((entry)=>entry.giver)});
  }
  if(request.method!=="POST") return json({error:"Método no permitido."},405);
  let body;
  try { body=await request.json(); }
  catch { return json({error:"Los datos no tienen un formato válido."},400); }

  if(body.action==="save-entry") {
    const {giver,recipient,ownerToken}=body;
    if(!people.includes(giver)) return json({error:"Elige tu nombre de la lista."},400);
    if(await db.get(finalKey,{type:"json"})) return json({error:"El sorteo ya está hecho y las respuestas están bloqueadas."},409);
    if(typeof ownerToken!=="string" || ownerToken.length<32) return json({error:"No se ha podido validar la clave privada de esta respuesta."},401);
    const isPending=pendingGivers.includes(giver);
    if(isPending) {
      if(recipient!==null) return json({error:"Selecciona «No sé a quién regalo» para guardar tu parte."},400);
    } else {
      if(!people.includes(recipient)) return json({error:"Elige a quién regalas de la lista."},400);
      if(giver===recipient) return json({error:"No puedes regalarte a ti mismo."},400);
    }

    const entries=await readEntries();
    const previous=entries.find((entry)=>entry.giver===giver);
    if(previous && previous.ownerTokenHash!==tokenHash(ownerToken)) {
      return json({error:"Ya hay una respuesta guardada con ese nombre. Para cambiarla, usa el mismo navegador donde se guardó."},403);
    }
    if(!isPending) {
      const duplicate=entries.find((entry)=>entry.giver!==giver && entry.recipient===recipient);
      if(duplicate) return json({error:"Esa persona ya ha sido elegida. Cada participante debe recibir un solo regalo."},409);
    }
    await db.setJSON(entryKey(giver),{giver,recipient:isPending?null:recipient,ownerTokenHash:tokenHash(ownerToken),updatedAt:new Date().toISOString()});
    return json({ok:true,updated:Boolean(previous),recipient:isPending?null:recipient},previous?200:201);
  }

  if(body.action==="delete-entry") {
    const {giver,ownerToken}=body;
    if(!people.includes(giver)) return json({error:"Elige un nombre válido."},400);
    if(await db.get(finalKey,{type:"json"})) return json({error:"El sorteo ya está hecho; las respuestas no se pueden borrar."},409);
    const entry=await db.get(entryKey(giver),{type:"json"});
    if(!entry) return json({error:"No hay una respuesta guardada con ese nombre."},404);
    if(typeof ownerToken!=="string" || entry.ownerTokenHash!==tokenHash(ownerToken)) {
      return json({error:"Solo se puede borrar desde el navegador donde se guardó esa respuesta."},403);
    }
    await db.delete(entryKey(giver));
    return json({ok:true});
  }

  if(body.action==="reveal-own") {
    const {giver}=body;
    if(!pendingGivers.includes(giver)) return json({error:"Esta consulta es solo para Abuelo Rafa, Abuela Pepa y Tío Miguel."},400);
    const assignments=await db.get(finalKey,{type:"json"});
    if(!assignments) return json({error:"El sorteo aún no se ha hecho. Espera a que las 14 personas rellenen su parte y a que la persona organizadora lo active."},409);
    return json({recipient:assignments[giver]});
  }

  if(body.action==="admin-list" || body.action==="draw") {
    const expected=process.env.AMIGO_ADMIN_PASSWORD;
    if(!expected) return json({error:"La contraseña maestra todavía no está configurada en Netlify."},503);
    if(typeof body.password!=="string" || body.password!==expected) return json({error:"La contraseña no coincide."},401);
    const entries=await readEntries();
    const finalAssignments=await db.get(finalKey,{type:"json"});
    if(body.action==="draw") {
      if(finalAssignments) return json({error:"El sorteo ya se hizo; no se puede repetir."},409);
      if(entries.length!==people.length) return json({error:`Todavía faltan ${people.length-entries.length} personas por rellenar su parte. No se puede sortear aún.`},409);
      const assignments=makeFinalAssignments(entries);
      if(!assignments) return json({error:"No se pudo crear un reparto válido. Revisa que las 11 respuestas conocidas sean distintas y no haya regalos para uno mismo."},409);
      const saved=await db.setJSON(finalKey,assignments,{onlyIfNew:true});
      if(!saved.modified) return json({error:"El sorteo ya se hizo; no se puede repetir."},409);
      return json({ok:true,drawn:true});
    }
    const byGiver=new Map(entries.map((entry)=>[entry.giver,entry]));
    const rows=[...people].sort((a,b)=>a.localeCompare(b,"es")).map((giver)=>{
      const entry=byGiver.get(giver);
      return {giver,recipient:entry?.recipient || finalAssignments?.[giver] || null,waitingForDraw:Boolean(entry && pendingGivers.includes(giver) && !finalAssignments)};
    });
    return json({entries:rows,completedCount:entries.length,canDraw:entries.length===people.length && !finalAssignments,drawn:Boolean(finalAssignments)});
  }

  return json({error:"Acción no reconocida."},400);
};
