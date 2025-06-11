
/* =========================================================
   firebase-love-app.js  –  Unified client script
   ---------------------------------------------------------
   - Handles Firebase initialisation, auth, routing, profile
     management, grievance CRUD, and UI updates.
   - Auto‑creates user profile if missing.
   - All emails stored / queried in lower‑case.
   ========================================================= */

/* ---------- Firebase Config & Initialisation ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyA8QfLoifA2-DjldYaMBeIge1D6TbRpBWw",
  authDomain: "summa-57ad5.firebaseapp.com",
  projectId: "summa-57ad5",
  storageBucket: "summa-57ad5.appspot.com",
  messagingSenderId: "472212537134",
  appId: "1:472212537134:web:fc930ea95fa9b7ffc4c4bf"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ---------- Utility: deterministic heart‑icon per UID ---------- */
const HEARTS = ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎"];
function assignUserIcon(uid){
  return HEARTS[uid.split('').reduce((s,c)=>s+c.charCodeAt(0),0)%HEARTS.length];
}

/* ---------- Bootstrapping / Routing ---------- */
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async user => {
    const page = location.pathname.split('/').pop();
    const protectedPages = ["dashboard.html","grievance.html","profile.html"];
    const authPages      = ["login.html","register.html","index.html",""];

    if (user){
      await ensureUserProfile(user);

      if (authPages.includes(page)){
        return location.replace("dashboard.html");
      }
      if (protectedPages.includes(page)){
        if (page==="dashboard.html") loadDashboard();
        if (page==="profile.html")   loadProfilePage();
        if (page==="grievance.html") initGrievanceForm();
      }
    }else{
      if (protectedPages.includes(page)){
        location.replace("login.html");
      }
    }
  });

  const page = location.pathname.split('/').pop();
  if (page==="register.html") initRegisterForm();
  if (page==="login.html")    initLoginForm();

  document.body.addEventListener('click',e=>{
    if (e.target.closest('#logout')){
      e.preventDefault();
      auth.signOut().then(()=>location.replace("login.html"));
    }
  });
});

/* ---------- Ensure profile document exists ---------- */
async function ensureUserProfile(user){
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists){
    await ref.set({
      email: (user.email||"").toLowerCase(),
      nickname: user.displayName||"",
      partnerEmail: "",
      userIcon: assignUserIcon(user.uid),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

/* ======================================================
   AUTH: Register & Login
   ====================================================== */
function initRegisterForm(){
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const nickname = form.nickname.value.trim();
    const email    = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const partner  = form.partnerEmail.value.trim().toLowerCase();

    try{
      const cred = await auth.createUserWithEmailAndPassword(email,password);
      await db.collection("users").doc(cred.user.uid).set({
        email,nickname,partnerEmail:partner,
        userIcon: assignUserIcon(cred.user.uid),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Registration successful!");
      location.replace("dashboard.html");
    }catch(err){
      console.error("Register error:",err);
      alert(err.message);
    }
  });
}

function initLoginForm(){
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const pwd   = form.password.value;
    try{
      await auth.signInWithEmailAndPassword(email,pwd);
      await ensureUserProfile(auth.currentUser);
      location.replace("dashboard.html");
    }catch(err){
      console.error("Login error:",err);
      alert(err.message);
    }
  });
}

/* ======================================================
   PROFILE PAGE
   ====================================================== */
function loadProfilePage(){
  const user = auth.currentUser; if (!user) return;
  initProfileForm(user);

  db.collection("users").doc(user.uid).get().then(doc=>{
    if (!doc.exists) return;
    const d=doc.data();
    document.getElementById("nickname").value      = d.nickname     ||"";
    document.getElementById("partnerEmail").value  = d.partnerEmail ||"";
    document.getElementById("profile-icon-preview").textContent = d.userIcon||"❤️";
  }).catch(err=>console.error("Profile load:",err));
}

function initProfileForm(user){
  const form = document.getElementById("profileForm");
  if (!form) return;
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const nickname=form.nickname.value.trim();
    const partner =form.partnerEmail.value.trim().toLowerCase();
    try{
      await db.collection("users").doc(user.uid).set({nickname,partnerEmail:partner},{merge:true});
      alert("Profile updated!");
      location.replace("dashboard.html");
    }catch(err){
      console.error("Profile update:",err);
      alert(err.message);
    }
  });
}

/* ======================================================
   GRIEVANCE SUBMISSION
   ====================================================== */
function initGrievanceForm(){
  const form=document.getElementById("grievanceForm");
  if (!form) return;
  const btn=form.querySelector("button[type='submit']");

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const user=auth.currentUser;if(!user)return;
    btn.disabled=true;btn.innerHTML="<i class='iconoir-clock'></i> Submitting...";

    try{
      const meSnap=await db.collection("users").doc(user.uid).get();
      const me=meSnap.data();
      if(!me.partnerEmail){
        alert("Please set partner email in profile first."); return location.replace("profile.html");
      }
      const partnerQ=await db.collection("users").where("email","==",me.partnerEmail).limit(1).get();
      const partnerId=partnerQ.empty?null:partnerQ.docs[0].id;

      await db.collection("grievances").add({
        title:form.title.value.trim(),
        description:form.description.value.trim(),
        mood:form.mood.value,
        severity:form.severity.value,
        timestamp:firebase.firestore.FieldValue.serverTimestamp(),
        senderId:user.uid,
        senderNickname:me.nickname,
        receiverId:partnerId,
        receiverEmail:me.partnerEmail,
        status:"Pending"
      });
      location.replace("thankyou.html");
    }catch(err){
      console.error("Grievance error:",err);
      alert(err.message);
      btn.disabled=false;btn.innerHTML="<i class='iconoir-send'></i> Submit 💌";
    }
  });
}

/* ======================================================
   DASHBOARD
   ====================================================== */
async function loadDashboard(){
  const user=auth.currentUser;if(!user)return;
  try{
    const snap=await db.collection("users").doc(user.uid).get();
    const me=snap.data();

    document.getElementById("welcome-user").innerText=`Welcome, ${me.nickname||user.email}!`;
    document.getElementById("user-icon").textContent=me.userIcon;
    document.querySelector("#user-profile p").textContent=me.nickname||"You";

    if(me.partnerEmail){
      const pQ=await db.collection("users").where("email","==",me.partnerEmail).limit(1).get();
      const pIcon=document.getElementById("partner-icon");
      const pName=document.querySelector("#partner-profile p");
      if(!pQ.empty){
        const pd=pQ.docs[0].data();
        pIcon.textContent=pd.userIcon||"💜";
        pName.textContent=pd.nickname||"Partner";
      }else{
        pIcon.textContent="❔";
        pName.textContent="Partner (Unregistered)";
      }
    }

    loadGrievances(user.uid,"sent");
    loadGrievances(user.email.toLowerCase(),"received");
  }catch(err){
    console.error("Dashboard load:",err);alert(err.message);
  }
}

function loadGrievances(identifier,type){
  const list=document.getElementById(`${type}-grievances-list`);if(!list)return;
  const field=type==="sent"?"senderId":"receiverEmail";

  db.collection("grievances").where(field,"==",identifier).orderBy("timestamp","desc")
    .onSnapshot(snap=>{
      if(snap.empty){
        list.innerHTML=`<p>${type==="sent"?"No grievances sent yet.":"Hooray! No grievances received."}</p>`;
        return;
      }
      list.innerHTML=[...snap.docs].map(d=>{
        const g=d.data();
        return `<div class="grievance-item">
                  <h4>${g.title}</h4>
                  <p>${g.description}</p>
                  <div class="meta">
                    <span>Mood: ${g.mood} | Severity: ${g.severity}</span><br>
                    <span>${g.timestamp?g.timestamp.toDate().toLocaleDateString():""}</span>
                  </div>
                  <div class="grievance-status">Status: ${g.status}</div>
                  ${type==="received"?statusUpdateForm(d.id,g.status):""}
               </div>`;
      }).join('');
    },err=>{
      console.error("Grievance load:",err);
      list.innerHTML="<p style='color:red'>Error loading grievances.</p>";
    });
}

function statusUpdateForm(id,current){
  return `<form class="status-update-form" data-id="${id}">
            <select name="status">
              <option value="Pending" ${current==="Pending"?"selected":""}>⏳ Pending</option>
              <option value="Working on it" ${current==="Working on it"?"selected":""}>🛠️ Working on it</option>
              <option value="Resolved" ${current==="Resolved"?"selected":""}>✅ Resolved</option>
            </select>
            <button type="submit">Update</button>
          </form>`;
}

document.addEventListener("submit",async e=>{
  if(!e.target.matches(".status-update-form"))return;
  e.preventDefault();
  const form=e.target;
  const id=form.dataset.id;
  const status=form.status.value;
  try{
    await db.collection("grievances").doc(id).update({status});
  }catch(err){
    console.error("Status update error:",err);alert(err.message);
  }
});
