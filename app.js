// MultipleFiles/app.js
import {
  auth, db, provider,
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  query, where, orderBy, serverTimestamp, onSnapshot,
  onAuthStateChanged, signInWithPopup, signOut
} from "./firebase.js";

/* ---------------- DOM Elements ---------------- */
const stackEl = document.getElementById("card-stack");
const emptyEl = document.getElementById("empty-state");

// Updated login button references
const loginOptionsDiv = document.getElementById("login-options");
const btnLoginGoogle  = document.getElementById("btn-login-google");
const btnLogout = document.getElementById("btn-logout");
const btnAdmin  = document.getElementById("btn-admin");

const btnLike   = document.getElementById("btn-like");
const btnNope   = document.getElementById("btn-nope");
const btnSkip   = document.getElementById("btn-skip");
const btnReview = document.getElementById("btn-review");

const openInterested = document.getElementById("open-interested");
const openNot        = document.getElementById("open-not");
const openSkipped    = document.getElementById("open-skipped");

const listBack  = document.getElementById("list-backdrop");
const listTitle = document.getElementById("list-title");
const listBody  = document.getElementById("list-body");
document.getElementById("list-close").onclick = ()=> listBack.style.display="none";

const peopleBack  = document.getElementById("people-backdrop");
const peopleTitle = document.getElementById("people-title");
const peopleBody  = document.getElementById("people-body");
document.getElementById("people-close").onclick = ()=> peopleBack.style.display="none";

/* ---------------- State Variables ---------------- */
let user = null;
let allSpots = []; // All spots loaded from Firestore
let currentSpots = []; // Spots filtered based on user choices
let currentSpotIndex = 0;
let historyIndex = []; // To track previous spot indices for 'review'

/* ---------------- Helper Function ---------------- */
// Escapes HTML entities to prevent XSS
const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ---------------- Authentication ---------------- */
btnLoginGoogle.onclick  = async ()=> {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Google Sign-in Error:", error);
    alert("Failed to sign in with Google: " + error.message);
  }
};
btnLogout.onclick = async ()=> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-out Error:", error);
    alert("Failed to sign out: " + error.message);
  }
};
btnAdmin.onclick  = ()=> {
  // Navigate to admin login page
  location.href = 'admin-login.html';
};

onAuthStateChanged(auth, async (u)=>{
  user = u || null;
  if (user) {
    loginOptionsDiv.style.display = "none"; // Hide login buttons
    btnLogout.style.display = ""; // Show logout button
  } else {
    loginOptionsDiv.style.display = "flex"; // Show login buttons
    btnLogout.style.display = "none"; // Hide logout button
  }
  // Load all spots and then filter based on user choices
  await loadAllSpots();
  await filterSpotsForUser();
  renderCurrentSpot();
});

/* ---------------- Data Loading & Filtering ---------------- */
async function loadAllSpots(){
  try{
    // Fetch all spots, ordered by creation date (newest first)
    const q = query(collection(db,"spots"), orderBy("createdAt","desc"));
    const snap = await getDocs(q);
    allSpots = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }catch(e){
    console.error("Error loading all spots:", e);
    allSpots = [];
  }
}

async function filterSpotsForUser(){
  currentSpots = [];
  currentSpotIndex = 0;
  historyIndex = [];

  if (!user) {
    // If no user, show all spots (or a subset, depending on desired behavior)
    currentSpots = [...allSpots];
    return;
  }

  try {
    // Get all choices made by the current user
    const qChoices = query(collection(db, "userChoices"), where("userId", "==", user.uid));
    const choicesSnap = await getDocs(qChoices);
    const chosenSpotIds = new Set();
    choicesSnap.forEach(d => chosenSpotIds.add(d.data().spotId));

    // Filter out spots the user has already made a choice on
    currentSpots = allSpots.filter(spot => !chosenSpotIds.has(spot.id));

  } catch (e) {
    console.error("Error filtering spots for user:", e);
    // Fallback: show all spots if filtering fails
    currentSpots = [...allSpots];
  }
}

/* ---------------- UI: Card Render & Swipe Logic ---------------- */
function renderCurrentSpot(){
  stackEl.innerHTML = ""; // Clear previous card
  if (!currentSpots.length || currentSpotIndex >= currentSpots.length){
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const s = currentSpots[currentSpotIndex];
  const img = s.imageURL || s.image || "";

  const card = document.createElement("div");
  card.className = "trip-card";
  card.id = "active-card";
  card.innerHTML = `
    <div class="overlay like">❤️</div>
    <div class="overlay dislike">💔</div>
    <div class="overlay skip">⏩</div>
    <div class="overlay review">🔄</div>

    <img src="${esc(img)}" alt="${esc(s.name||'Spot')}" onerror="this.style.display='none'">
    <div class="content">
      <h3>${esc(s.name||"Untitled spot")}</h3>
      <p><b>Cost:</b> ₹${esc(s.cost ?? "-")}</p>
      <p><b>People:</b> ${esc(s.people ?? "-")}</p>
      <p><b>Points:</b> ${esc(s.points || "-")}</p>
      <p><b>Dates:</b> ${esc(s.startDate || "-")} → ${esc(s.endDate || "-")}</p>
      <p><b>Transport:</b> ${esc(s.transport || "-")}</p>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="pill" id="btn-spot-people-int">People Interested ❤️</button>
        <button class="pill" id="btn-spot-people-no">People Not Interested 💔</button>
        <button class="pill" id="btn-spot-people-skip">People Skipped ⏩</button>
      </div>
    </div>
  `;
  stackEl.appendChild(card);
  attachSwipe(card);

  // Attach event listeners for "People" buttons for the current spot
  document.getElementById("btn-spot-people-int").onclick = ()=> openPeopleForSpot("interested");
  document.getElementById("btn-spot-people-no").onclick  = ()=> openPeopleForSpot("not_interested");
  document.getElementById("btn-spot-people-skip").onclick= ()=> openPeopleForSpot("skipped");
}

function attachSwipe(card){
  let startX = 0, startY = 0, isDragging = false;
  const oLike   = card.querySelector(".overlay.like");
  const oNope   = card.querySelector(".overlay.dislike");
  const oSkip   = card.querySelector(".overlay.skip");
  const oReview = card.querySelector(".overlay.review");

  const startDrag = (e) => {
    isDragging = true;
    startX = e.clientX ?? e.touches[0].clientX;
    startY = e.clientY ?? e.touches[0].clientY;
    card.classList.remove("snap-back"); // Remove transition for smooth dragging
  };

  const drag = (e) => {
    if (!isDragging) return;
    const currentX = e.clientX ?? e.touches[0].clientX;
    const currentY = e.clientY ?? e.touches[0].clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    card.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${deltaX / 12}deg)`;

    // Update overlay opacity based on swipe direction
    oLike.style.opacity   = deltaX > 50 ? "1" : "0";
    oNope.style.opacity   = deltaX < -50 ? "1" : "0";
    oSkip.style.opacity   = deltaY < -50 ? "1" : "0";
    oReview.style.opacity = deltaY > 50 ? "1" : "0";
  };

  const endDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;
    const currentX = e.clientX ?? e.changedTouches[0].clientX;
    const currentY = e.clientY ?? e.changedTouches[0].clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // Determine action based on swipe threshold
    if (deltaX > 110)  return performAction("interested", card);
    if (deltaX < -110) return performAction("not_interested", card);
    if (deltaY < -110) return performAction("skipped", card);
    if (deltaY > 110)  return performAction("review", card);

    // If no action, snap back
    card.classList.add("snap-back");
    card.style.transform = "";
    oLike.style.opacity = oNope.style.opacity = oSkip.style.opacity = oReview.style.opacity = "0";
  };

  card.addEventListener("pointerdown", startDrag, {passive: true});
  window.addEventListener("pointermove", drag, {passive: true});
  window.addEventListener("pointerup", endDrag, {passive: true});
}

async function performAction(kind, card){
  const s = currentSpots[currentSpotIndex];
  if (!s?.id) return; // No spot to act on

  // Add exit animation class
  if (kind === "interested") card.classList.add("exit-right");
  if (kind === "not_interested") card.classList.add("exit-left");
  if (kind === "skipped") card.classList.add("exit-up");
  if (kind === "review") card.classList.add("exit-down");

  // Persist choice to Firestore if not a 'review' action and user is logged in
  if (kind !== "review" && user) {
    try {
      await setDoc(doc(db, "userChoices", `${user.uid}_${s.id}`), {
        userId: user.uid,
        spotId: s.id,
        choice: kind,
        timestamp: serverTimestamp(),
        userName: user.displayName || user.email, // Store user info for people list
        userEmail: user.email
      });
      console.log(`Choice '${kind}' saved for spot ${s.name}`);
    } catch (e) {
      console.error("Failed to save choice:", e);
      alert("Failed to save your choice. Check console for details.");
    }
  }

  // Logic to move to the next/previous card
  const afterAnimation = async () => {
    if (kind === "review") {
      if (historyIndex.length > 0) {
        currentSpotIndex = historyIndex.pop(); // Go back to previous spot
      } else {
        currentSpotIndex = Math.max(0, currentSpotIndex - 1); // Just go back one if no history
      }
    } else {
      historyIndex.push(currentSpotIndex); // Save current index to history
      currentSpotIndex = Math.min(currentSpots.length, currentSpotIndex + 1); // Move to next spot
      // After a like/dislike/skip, re-filter spots to remove the current one
      await filterSpotsForUser();
    }
    renderCurrentSpot(); // Render the new current spot
  };

  // Ensure the animation completes before rendering the next card
  let animationDone = false;
  card.addEventListener("transitionend", () => {
    if (!animationDone) {
      animationDone = true;
      afterAnimation();
    }
  }, {once: true});

  // Fallback for transitionend not firing (e.g., if element is removed too quickly)
  setTimeout(() => {
    if (!animationDone) {
      animationDone = true;
      afterAnimation();
    }
  }, 300); // A bit longer than the CSS transition duration
}

/* --------------- List Modals (My Interested/Not Interested/Skipped) --------------- */
openInterested.onclick = () => openUserList("interested");
openNot.onclick        = () => openUserList("not_interested");
openSkipped.onclick    = () => openUserList("skipped");

function openUserList(choice){
  if (!user){ alert("Please login first to view your lists."); return; }
  listBack.style.display="flex";
  listTitle.textContent =
    choice === "interested" ? "My Interested Spots" :
    choice === "not_interested" ? "My Not Interested Spots" :
    "My Skipped Spots";
  listBody.textContent="Loading…";

  // Listen for real-time updates to user's choices
  const qChoices = query(
    collection(db,"userChoices"),
    where("userId","==", user.uid),
    where("choice","==", choice),
    orderBy("timestamp","desc")
  );

  onSnapshot(qChoices, async (snap)=>{
    if (snap.empty){
      listBody.innerHTML = `<p class="muted">Nothing here yet.</p>`;
      return;
    }

    const spotIds = snap.docs.map(d => d.data().spotId);
    if (spotIds.length === 0) {
      listBody.innerHTML = `<p class="muted">Nothing here yet.</p>`;
      return;
    }

    // Fetch spot details for the chosen spot IDs
    const spotPromises = spotIds.map(id => getDoc(doc(db, "spots", id)));
    const spotResults = await Promise.all(spotPromises);
    const items = spotResults.filter(r => r.exists()).map(r => ({ id:r.id, ...r.data() }));

    const wrap = document.createElement("div");
    wrap.className="list-grid";
    items.forEach(s=>{
      const div=document.createElement("div");
      div.className="list-item";
      const img = esc(s.imageURL||s.image||"");
      div.innerHTML = `
        <img src="${img}" alt="${esc(s.name||'Spot')}" onerror="this.style.display='none'">
        <div>
          <div><strong>${esc(s.name||"Untitled")}</strong></div>
          <div class="muted" style="font-size:12px">${esc(s.points||"")}</div>
        </div>`;
      wrap.appendChild(div);
    });
    listBody.innerHTML="";
    listBody.appendChild(wrap);
  }, (err)=>{
    console.error("Error loading user list:", err);
    listBody.innerHTML = `<p class="muted">Error loading list: ${err.message}</p>`;
  });
}

/* --------------- People for Current Spot Modal --------------- */
function openPeopleForSpot(kind){
  if (currentSpotIndex >= currentSpots.length) return;
  const s = currentSpots[currentSpotIndex];
  if (!s?.id) return;

  peopleBack.style.display="flex";
  peopleTitle.textContent =
    kind === "interested" ? `People Interested in ${esc(s.name||"")}` :
    kind === "not_interested" ? `People Not Interested in ${esc(s.name||"")}` :
    `People who Skipped ${esc(s.name||"")}`;
  peopleBody.textContent="Loading…";

  // Listen for real-time updates to choices for this specific spot and choice type
  const qPeople = query(
    collection(db,"userChoices"),
    where("spotId","==", s.id),
    where("choice","==", kind),
    orderBy("timestamp","desc")
  );

  onSnapshot(qPeople, (snap)=>{
    if (snap.empty){
      peopleBody.innerHTML = `<p class="muted">No entries yet.</p>`;
      return;
    }
    const list = document.createElement("div");
    list.className="list-grid"; // Reusing list-grid for simple display
    let i=0;
    snap.forEach(doc=>{
      const x=doc.data();
      const row=document.createElement("div");
      row.className="list-item"; // Reusing list-item for styling
      row.style.display = 'block'; // Override flex for simple list
      row.innerHTML = `
        <div><strong>#${++i}</strong></div>
        <div class="muted" style="font-size:13px">Email: ${esc(x.userEmail||"-")}</div>
        <div class="muted" style="font-size:11px">UID: ${esc(x.userId||"-")}</div>`;
      list.appendChild(row);
    });
    peopleBody.innerHTML="";
    peopleBody.appendChild(list);
  }, (err)=>{
    console.error("Error loading people list:", err);
    peopleBody.innerHTML = `<p class="muted">Error loading people: ${err.message}</p>`;
  });
}

/* --------------- Buttons & Keyboard Shortcuts --------------- */
btnLike.onclick   = ()=> { const c=document.getElementById("active-card"); if(c) performAction("interested", c); };
btnNope.onclick   = ()=> { const c=document.getElementById("active-card"); if(c) performAction("not_interested", c); };
btnSkip.onclick   = ()=> { const c=document.getElementById("active-card"); if(c) performAction("skipped", c); };
btnReview.onclick = ()=> { const c=document.getElementById("active-card"); if(c) performAction("review", c); };

window.addEventListener("keydown", (e)=>{
  const c=document.getElementById("active-card");
  if(!c) return;
  if (e.key==="ArrowRight") performAction("interested", c);
  if (e.key==="ArrowLeft")  performAction("not_interested", c);
  if (e.key==="ArrowUp")    performAction("skipped", c);
  if (e.key==="ArrowDown")  performAction("review", c);
});
