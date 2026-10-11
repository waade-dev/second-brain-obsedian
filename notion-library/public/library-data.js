export async function fetchCollection({fetchImpl=fetch, live=false, fresh=false}={}) {
  let connectionError;
  try {
    const response=await fetchImpl(`/api/library${fresh?'?fresh=1':''}`,{cache:'no-store',signal:AbortSignal.timeout(55000)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Notion is unavailable.');
    if(!Array.isArray(data.rows))throw new Error('Notion returned an invalid collection.');
    return {...data,live:true,connectionError:''};
  } catch(error) {
    connectionError=error.message;
    // Preserve a previously connected collection during an outage.
    if(live)throw error;
  }
  // Snapshot mode also refreshes: never permanently hold the first captured rows.
  const response=await fetchImpl('/snapshot.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Could not load the saved snapshot.');
  const snapshot=await response.json();
  if(!Array.isArray(snapshot.rows))throw new Error('The saved snapshot is invalid.');
  return {...snapshot,live:false,connectionError};
}
