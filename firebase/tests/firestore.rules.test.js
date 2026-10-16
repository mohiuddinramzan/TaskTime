// NOT executed in the authoring environment (needs Java + Firebase emulator + npm install).
// Run:  cd firebase && npm i -D @firebase/rules-unit-testing firebase && npx firebase emulators:exec --only firestore "node --test tests/"
const test=require('node:test');const fs=require('fs'),path=require('path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
let env;
test.before(async()=>{env=await initializeTestEnvironment({projectId:'demo-tasktime',firestore:{rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}})});
test.after(()=>env.cleanup());
const task=(o={})=>({id:'t1',title:'x',priority:'low',status:'pending',createdAt:1,updatedAt:1,deletedAt:null,schemaVersion:2,deviceId:'d',syncedAt:serverTimestamp(),...o});
test('owner can create/read own task',async()=>{const db=env.authenticatedContext('A').firestore();await assertSucceeds(setDoc(doc(db,'users/A/tasks/t1'),task()));await assertSucceeds(getDoc(doc(db,'users/A/tasks/t1')))});
test('other user cannot read or write',async()=>{const b=env.authenticatedContext('B').firestore();await assertFails(getDoc(doc(b,'users/A/tasks/t1')));await assertFails(setDoc(doc(b,'users/A/tasks/t2'),task({id:'t2'})))});
test('anonymous denied',async()=>{const u=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(u,'users/A/tasks/t1')))});
test('unknown fields, bad enums, long titles, id mismatch are rejected',async()=>{const a=env.authenticatedContext('A').firestore();
 await assertFails(setDoc(doc(a,'users/A/tasks/t3'),task({id:'t3',evil:1})));await assertFails(setDoc(doc(a,'users/A/tasks/t4'),task({id:'t4',priority:'urgent'})));
 await assertFails(setDoc(doc(a,'users/A/tasks/t5'),task({id:'t5',title:'x'.repeat(201)})));await assertFails(setDoc(doc(a,'users/A/tasks/t6'),task({id:'other'})))});
test('older update cannot overwrite newer; hard delete denied',async()=>{const a=env.authenticatedContext('A').firestore();
 await assertSucceeds(setDoc(doc(a,'users/A/tasks/t7'),task({id:'t7',updatedAt:50})));await assertFails(setDoc(doc(a,'users/A/tasks/t7'),task({id:'t7',updatedAt:10})));
 await assertSucceeds(setDoc(doc(a,'users/A/tasks/t7'),task({id:'t7',updatedAt:60,deletedAt:60})));await assertFails(deleteDoc(doc(a,'users/A/tasks/t7')))});
test('paths outside users/{uid} are denied',async()=>{const a=env.authenticatedContext('A').firestore();await assertFails(setDoc(doc(a,'public/x'),{a:1}));await assertFails(setDoc(doc(a,'users/A/other/x'),{a:1}))});
