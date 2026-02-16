/* ---------------- Mobile Menu Toggle ---------------- */
function setupMenu() {
  const menuToggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");
  const navLinks = document.querySelectorAll(".nav-link");

  const closeMenu = () => {
    if (sidebar.classList.contains("active")) {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    }
  };

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      overlay.classList.toggle("active");
    });

    overlay.addEventListener("click", closeMenu);
    navLinks.forEach((link) => link.addEventListener("click", closeMenu));
  }
}
setupMenu(); // Initialize the menu functionality

/* ---------------- Firebase Init ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyA-Fv4SsvvMu8K2-eEk4t3ffWB_brbMoJU",
  authDomain: "rentify-58df7.firebaseapp.com",
  projectId: "rentify-58df7",
  storageBucket: "rentify-58df7.appspot.com",
  messagingSenderId: "892024907401",
  appId: "1:892024907401:web:35876b5cd252f9f81c0858",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------------- Small helpers ---------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmtMoney = (n) =>
  n == null ? "—" : `৳${Number(n).toLocaleString("en-BD")}`;
const fmtDate = (d) => {
  if (!d) return "—";
  // Handles Firestore Timestamps, ISO strings, and Date objects
  const dt = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d);
  // Return date in YYYY-MM-DD for input[type=date] compatibility and display
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
};
// NEW: Helper to format date as "Month YYYY"
const fmtMonthYear = (d) => {
  if (!d) return "—";
  const dt = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};
const fmtDateForInput = (d) => {
  if (!d) return "";
  const dt = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
// NEW: Helper to generate random transaction ID
const generateTxId = (method) => {
  // If a method is provided (e.g., "bkash"), use a sanitized lowercase
  // full-method prefix so the ID becomes `bkash_<timestamp><rnd>` instead of `BKAS_...`.
  // Fallback to "TXN" when no method is given.
  const prefix = method
    ? String(method)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
    : "TXN";
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}_${timestamp}${randomSuffix}`;
};

function setActiveSection(name) {
  $$(".nav-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.section === name)
  );
  $$(".section").forEach((s) =>
    s.classList.toggle("active", s.id === `section-${name}`)
  );
}

/* ---------------- Sidebar navigation ---------------- */
$$(".nav-link").forEach((a) =>
  a.addEventListener("click", () => setActiveSection(a.dataset.section))
);

/* ---------------- NEW: Message Bar Helper ---------------- */
let messageTimer;
function showTenantMessage(message, isError = false) {
  const messageBar = $("#tenantMessage");
  if (!messageBar) return;

  messageBar.textContent = message;
  messageBar.className = "message-bar"; // Reset classes
  if (isError) {
    messageBar.classList.add("error");
  } else {
    messageBar.classList.add("success");
  }

  messageBar.classList.add("active");

  // Clear existing timer if any
  if (messageTimer) {
    clearTimeout(messageTimer);
  }

  // Hide after 4 seconds
  messageTimer = setTimeout(() => {
    messageBar.classList.remove("active");
  }, 4000);
}

/* ---------------- NEW: Latest Announcement Bar Logic ---------------- */
function setupLatestAnnouncementBar() {
  const bar = $("#latestAnnouncementBar");
  const closeBtn = $("#latestAnnouncementClose");

  if (!bar || !closeBtn) return;

  closeBtn.addEventListener("click", () => {
    const announcementId = closeBtn.dataset.announcementId;
    if (announcementId) {
      // Store the ID of the dismissed announcement
      localStorage.setItem("dismissedAnnouncementId", announcementId);
    }
    bar.classList.add("hidden"); // Hide the bar
  });
}

/* ---------------- State ---------------- */
let currentUser = null;
let tenantProfile = null;
let leases = [];
let payments = []; // State for payments
let announcements = []; // NEW: Global state for announcements
let specificAnnouncementsUnsub = null; // NEW: Listener unsubscribe function
let generalAnnouncementsUnsub = null; // NEW: Listener unsubscribe function
let leaseOfferUnsub = null; // NEW: Listener for lease offers
let currentLeaseOffer = null; // NEW: State for the pending offer

/* ---------------- Auth guard (tenant only) ---------------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = user;

  try {
    const tDoc = await db.collection("tenants").doc(user.uid).get();
    if (!tDoc.exists) {
      const lDoc = await db.collection("landlords").doc(user.uid).get();
      if (lDoc.exists) {
        window.location.href = "landlord_dashboard.html";
        return;
      }
      await auth.signOut();
      window.location.href = "auth.html";
      return;
    }

    tenantProfile = { uid: user.uid, ...tDoc.data() };
    $("#tenantName").textContent = tenantProfile.fullName || "Tenant";

    renderProfileDetails();
    setupNotificationButton(); // NEW: Setup notification button
    setupLatestAnnouncementBar(); // NEW: Setup a listener for the close button

    listenForLeaseOffers(); // NEW: Listen for lease offers
    await loadLeasesAndStats();
    await loadMaintenance();
    await loadPayments();
    startAnnouncementListeners(); // MODIFIED: Start real-time listeners
  } catch (e) {
    console.error("Error loading tenant data:", e);
  }
});

function renderProfileDetails() {
  $("#pName").textContent = tenantProfile.fullName || "—";
  $("#pEmail").textContent = tenantProfile.email || currentUser.email || "—";
  $("#pPhone").textContent = tenantProfile.phone || "—";
  $("#pDob").textContent = tenantProfile.dob ? fmtDate(tenantProfile.dob) : "—";
  $("#pAddress").textContent = tenantProfile.address || "—";
  $("#pNid").textContent = tenantProfile.nid || "—";
  if (tenantProfile.createdAt?.toDate) {
    $("#pCreated").textContent = fmtDate(tenantProfile.createdAt);
  }
}

async function loadLeasesAndStats() {
  leases = [];
  // Check tenantProfile for active lease data
  if (tenantProfile && tenantProfile.propertyId) {
    // Found an active lease, add it to the leases array
    leases.push(tenantProfile);
  }

  const today = new Date();
  leases = leases.map((l) => {
    let next = l.leaseDate ? l.leaseDate.toDate() : null;
    if (next && l.rentPayDate) {
      const dueDay = l.rentPayDate;
      let dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      next = dueDate;
    }
    return { ...l, _next: next };
  });

  const totalRent = leases.reduce(
    (acc, l) => acc + (Number(l.rentAmount) || 0),
    0
  );
  $("#monthlyRentTotal").textContent = fmtMoney(totalRent);

  if (leases.length > 0) {
    const soonest = leases.sort(
      (a, b) => new Date(a._next) - new Date(b._next)
    )[0];
    $("#nextDue").textContent = fmtDate(soonest?._next);
    if (soonest?.propertyId) {
      $("#nextDueLease").textContent = `For ${await getPropertyIdentifier(
        soonest.propertyId
      )}`;
    }
  } else {
    $("#nextDue").textContent = "—";
    $("#nextDueLease").textContent = "No active lease";
  }

  renderQuickActions();
  renderLeasesList();
}

async function renderLeasesList() {
  const list = $("#leasesList");
  list.innerHTML = "";

  if (!leases.length) {
    list.innerHTML = `<div class="list-item">No active lease found.</div>`;
    return;
  }

  for (const l of leases) {
    let propertyIdentifier = await getPropertyIdentifier(l.propertyId);
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <strong>${propertyIdentifier}</strong><br/>
                <span class="muted">Monthly Rent:</span> ${fmtMoney(
                  l.rentAmount
                )} &nbsp;•&nbsp;
                <span class="muted">Advance Paid:</span> ${fmtMoney(
                  l.advancePayment || 0
                )} <br/>
                <span class="muted">Next Due:</span> ${fmtDate(
                  l._next
                )} &nbsp;•&nbsp;
                <span class="muted">Expires on:</span> ${fmtDate(
                  l.leaseExpiryDate
                )}
            </div>
            <button class="btn" data-action="details" data-property-id="${
              l.propertyId
            }">Details</button>
        </div>
        `;
    list.appendChild(div);
  }
}

function renderQuickActions() {
  const wrap = $("#quickActions");
  wrap.innerHTML = "";

  if (!leases.length) {
    wrap.innerHTML = `<div class="qa" style="text-align: left; cursor: default;"><div class="qa-title">No Active Lease</div>
            <p class="qa-meta" style="margin-top: 8px;">When your landlord assigns a lease and you confirm it, your actions will appear here.</p></div>`;
    return;
  }

  leases.forEach(async (l) => {
    const el = document.createElement("div");
    el.className = "qa";
    let propertyIdentifier = await getPropertyIdentifier(l.propertyId);

    // Reconstruct the full lease object for the buttons
    const leaseForButton = {
      propertyId: l.propertyId,
      landlordId: l.landlordId,
      rentAmount: l.rentAmount,
      // Add any other properties needed by the buttons
    };

    el.innerHTML = `
            <div class="qa-title">Lease at ${propertyIdentifier}</div>
            <div class="qa-meta">Next Due: ${fmtDate(
              l._next
            )} • Monthly: ${fmtMoney(l.rentAmount)}</div>
            <div class="qa-actions">
              <button class="btn primary" data-action="pay" data-lease='${JSON.stringify(
                leaseForButton
              )}'>Pay Rent</button>
              <button class="btn" data-action="maint" data-lease='${JSON.stringify(
                leaseForButton
              )}'>Request Maintenance</button>
            </div>
          `;
    wrap.appendChild(el);
  });
  wrap.addEventListener("click", qaHandler);
}

async function qaHandler(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const leaseData = JSON.parse(btn.dataset.lease);

  leaseData.propertyIdentifier = await getPropertyIdentifier(
    leaseData.propertyId
  );

  if (btn.dataset.action === "pay") openPayDialog(leaseData);
  if (btn.dataset.action === "maint") openMaintDialog(leaseData);
}

async function loadMaintenance() {
  const list = $("#maintenanceList");
  list.innerHTML = "";

  let rows = [];
  const maintQuery = await db
    .collection("maintenance_requests")
    .where("tenantId", "==", currentUser.uid)
    .get();

  maintQuery.forEach((d) => rows.push({ id: d.id, ...d.data() }));

  rows.sort(
    (a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
  );

  const openCount = rows.filter(
    (r) => r.status === "open" || r.status === "in-progress"
  ).length;
  $("#openMaintCount").textContent = String(openCount);
  $("#lastMaintUpdate").textContent = rows[0]?.createdAt
    ? `Last request: ${fmtDate(rows[0].createdAt)}`
    : "No open requests";

  if (!rows.length) {
    list.innerHTML = `<div class="list-item">No maintenance requests yet.</div>`;
    return;
  }

  for (const r of rows) {
    const d = document.createElement("div");
    d.className = "list-item maintenance-item"; // Use consistent class
    const status = r.status || "open";

    // Conditionally create the action button
    const actionButton =
      status !== "completed"
        ? `<button class="btn primary" data-action="mark-complete" data-request-id="${r.id}">Mark as Solved</button>`
        : `<button class="btn" disabled>Solved</button>`;

    d.innerHTML = `
      <div class="maintenance-info">
        <strong>${r.title || "Request"}</strong>
        <span class="muted">
          Lease: ${await getPropertyIdentifier(r.propertyId)}
        </span>
        <span class="muted">
          Reported: ${fmtDate(r.createdAt)}
        </span>
      </div>
      <div class="maintenance-assignment">
        <span class="status-badge ${status}">
          ${status.replace("-", " ")}
        </span>
        <span class="muted" style="font-size: 13px;">
          Technician: ${r.technicianName || "None"}
        </span>
      </div>
      <div class="maintenance-actions">
        ${actionButton}
      </div>
    `;
    list.appendChild(d);
  }
}

// Event listener for "Mark as Solved" button
$("#maintenanceList").addEventListener("click", async (e) => {
  const target = e.target.closest("button[data-action='mark-complete']");
  if (!target) return;

  const id = target.dataset.requestId;
  if (!id) return;

  await markMaintenanceAsCompleted(id, target);
});

// Function to update maintenance status to 'completed'
async function markMaintenanceAsCompleted(id, button) {
  // Disable button to prevent double-click
  if (button) {
    button.disabled = true;
    button.textContent = "Updating...";
  }

  try {
    await db.collection("maintenance_requests").doc(id).update({
      status: "completed",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Refresh the list to show the change
    await loadMaintenance();
  } catch (error) {
    console.error("Error marking as completed:", error);
    showTenantMessage("Failed to update status. Please try again.", true);
    // Re-enable button on failure
    if (button) {
      button.disabled = false;
      button.textContent = "Mark as Solved";
    }
  }
}

async function getPropertyIdentifier(propertyId) {
  if (!propertyId) return "—";
  try {
    const propDoc = await db.collection("properties").doc(propertyId).get();
    if (propDoc.exists) {
      const prop = propDoc.data();
      const name = prop.propertyName || prop.address;
      const unit = prop.unit ? ` (Unit ${prop.unit})` : "";
      return `${name}${unit}`;
    }
  } catch (error) {
    console.error("Error getting property identifier:", error);
  }
  return "—";
}

/* ---------------- Payments Logic ---------------- */
async function loadPayments() {
  const list = $("#paymentsList");
  list.innerHTML = "";
  payments = []; // Clear local state

  const snap = await db
    .collection("payments")
    .where("tenantId", "==", currentUser.uid)
    .get();

  snap.forEach((doc) => {
    payments.push({ id: doc.id, ...doc.data() });
  });

  // Sort by payment date, newest first
  payments.sort(
    (a, b) => (b.paymentDate?.toDate() || 0) - (a.paymentDate?.toDate() || 0)
  );

  if (!payments.length) {
    list.innerHTML = `<div class="list-item">No payment history found.</div>`;
    return;
  }

  for (const p of payments) {
    const propertyIdentifier = await getPropertyIdentifier(p.propertyId);
    const div = document.createElement("div");
    div.className = "list-item payment-item"; // Use new class for styling
    div.innerHTML = `
      <div class="payment-info">
        <strong class="payment-amount">${fmtMoney(p.amountPaid)}</strong>
        <span class="muted">
          For: <strong>${propertyIdentifier}</strong>
        </span>
      </div>
      <div class="payment-details">
        <span class="muted">Paid On:</span>
        <strong>${fmtDate(p.paymentDate)}</strong>
        <span class="muted" style="margin-top: 4px;">Method:</span>
        <strong>${p.paymentMethod || "N/A"}</strong>
      </div>
      <div class="payment-details">
        <span class="muted">Payment For:</span>
        <strong>${fmtMonthYear(p.paymentForMonth)}</strong>
        <span class="muted" style="margin-top: 4px;">TXN ID:</span>
        <strong style="font-size: 12px; word-break: break-all;">${
          p.transactionId || "N/A"
        }</strong>
      </div>
      <div class="payment-status">
        <span class="status-badge completed">Successful</span>
      </div>
    `;
    list.appendChild(div);
  }

  renderRecentPayments(); // NEW: Render dashboard view
}

// NEW: Render Recent Payments for Dashboard
function renderRecentPayments() {
  const list = $("#recentPaymentsList");
  list.innerHTML = "";
  const recent = payments.slice(0, 3); // Get first 3

  if (!recent.length) {
    list.innerHTML = `<p class="muted" style="padding: 10px 0;">No recent payments.</p>`;
    return;
  }

  recent.forEach(async (p) => {
    const propertyIdentifier = await getPropertyIdentifier(p.propertyId);
    const div = document.createElement("div");
    div.className = "recent-list-item";
    div.innerHTML = `
      <div>
        <strong>${propertyIdentifier}</strong>
        <span class="muted">${fmtDate(p.paymentDate)}</span>
        <span class="muted">Method: <strong>${
          p.paymentMethod || "N/A"
        }</strong></span>
      </div>
      <strong class="item-amount">${fmtMoney(p.amountPaid)}</strong>
    `;
    list.appendChild(div);
  });
}

/* ---------------- Notification Logic ---------------- */

function setupNotificationButton() {
  const enableNotificationsBtn = $("#enableNotificationsBtn");
  if (!enableNotificationsBtn) return;

  if (!("Notification" in window)) {
    // Hide button if API is not supported
    enableNotificationsBtn.style.display = "none";
    return;
  }

  if (Notification.permission === "granted") {
    enableNotificationsBtn.textContent = "Notifications Enabled";
    enableNotificationsBtn.disabled = true;
  } else {
    enableNotificationsBtn.addEventListener(
      "click",
      requestNotificationPermission
    );
  }
}

async function requestNotificationPermission() {
  const enableNotificationsBtn = $("#enableNotificationsBtn");
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      enableNotificationsBtn.textContent = "Notifications Enabled";
      enableNotificationsBtn.disabled = true;
      showTenantMessage("Notifications enabled!", false);
      // Send a test notification
      new Notification("Notifications Enabled", {
        body: "You will now receive announcements as notifications.",
        icon: "https://placehold.co/64x64/4F46E5/FFFFFF?text=R", // Placeholder icon
      });
    } else {
      showTenantMessage("Notifications were not enabled.", true);
    }
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    showTenantMessage("Error setting up notifications.", true);
  }
}

function showNotification(announcement) {
  if (!("Notification" in window)) return; // Not supported
  if (Notification.permission !== "granted") return; // Permission not given

  new Notification(announcement.title, {
    body: announcement.details,
    icon: "https://placehold.co/64x64/4F46E5/FFFFFF?text=R", // Placeholder icon
    tag: announcement.id, // Use ID to prevent duplicate notifications
  });
}

/* ---------------- NEW: Lease Offer Logic ---------------- */
function listenForLeaseOffers() {
  if (leaseOfferUnsub) leaseOfferUnsub(); // Stop previous listener

  // Listen for pending offers for this tenant
  const offerQuery = db
    .collection("lease_offers")
    .where("tenantId", "==", currentUser.uid)
    .where("status", "==", "pending");

  leaseOfferUnsub = offerQuery.onSnapshot(
    async (snapshot) => {
      const offerSection = $("#leaseOfferSection");
      const offerDetails = $("#leaseOfferDetails");

      if (snapshot.empty) {
        // No pending offers
        offerSection.classList.add("hidden");
        currentLeaseOffer = null;
        return;
      }

      // Get the first pending offer
      const offerDoc = snapshot.docs[0];
      const offer = offerDoc.data();
      currentLeaseOffer = { id: offerDoc.id, ...offer }; // Store offer data globally

      // Get property and landlord details for display
      const propertyIdentifier = await getPropertyIdentifier(offer.propertyId);
      const landlordName = offer.landlordName || "Your Landlord";

      // Populate and show the offer panel
      offerDetails.innerHTML = `
            <strong>${landlordName}</strong> has offered you a lease for the property:<br/>
            <strong>Property:</strong> ${propertyIdentifier}<br/>
            <strong>Rent:</strong> ${fmtMoney(offer.rentAmount)} per month<br/>
            <strong>Lease Start:</strong> ${fmtDate(offer.leaseDate)}<br/>
            <strong>Lease End:</strong> ${fmtDate(offer.leaseExpiryDate)}<br/>
            <strong>Advance:</strong> ${fmtMoney(offer.advancePayment || 0)}
        `;
      offerSection.classList.remove("hidden");
    },
    (error) => {
      console.error("Error listening for lease offers:", error);
    }
  );
}

// NEW: Add click listener for Confirm Lease button
$("#confirmLeaseBtn").addEventListener("click", async () => {
  if (!currentLeaseOffer || !currentUser) return;

  const btn = $("#confirmLeaseBtn");
  btn.disabled = true;
  btn.textContent = "Confirming...";

  // This is the lease data that will be copied to the tenant's document
  const leaseData = {
    landlordId: currentLeaseOffer.landlordId,
    propertyId: currentLeaseOffer.propertyId,
    leaseDate: currentLeaseOffer.leaseDate,
    leaseExpiryDate: currentLeaseOffer.leaseExpiryDate,
    rentAmount: currentLeaseOffer.rentAmount,
    advancePayment: currentLeaseOffer.advancePayment,
    rentPayDate: currentLeaseOffer.rentPayDate,
  };

  try {
    const batch = db.batch();

    // 1. Update the tenant's main document with the active lease info
    const tenantRef = db.collection("tenants").doc(currentUser.uid);
    batch.update(tenantRef, leaseData);

    // 2. Update the property's occupant count
    const propertyRef = db
      .collection("properties")
      .doc(currentLeaseOffer.propertyId);
    batch.update(propertyRef, {
      occupants: firebase.firestore.FieldValue.increment(1),
    });

    // 3. Mark the offer as 'confirmed'
    const offerRef = db.collection("lease_offers").doc(currentLeaseOffer.id);
    batch.update(offerRef, { status: "confirmed" });

    // Commit all changes atomically
    await batch.commit();

    // Manually update local profile object to reflect new lease
    tenantProfile = { ...tenantProfile, ...leaseData };

    showTenantMessage("Lease confirmed successfully!", false);
    $("#leaseOfferSection").classList.add("hidden"); // Hide the offer panel
    currentLeaseOffer = null; // Clear the offer

    // Reload dashboard & lease lists with the new active lease
    await loadLeasesAndStats();
  } catch (error) {
    console.error("Error confirming lease:", error);
    showTenantMessage("Failed to confirm lease. Please try again.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm & Accept Lease";
  }
});

// NEW: Add click listener for Decline Lease button
$("#declineLeaseBtn").addEventListener("click", async () => {
  if (!currentLeaseOffer) return;

  const btn = $("#declineLeaseBtn");
  btn.disabled = true;
  btn.textContent = "Declining...";

  try {
    // Just update the offer status to 'declined'
    const offerRef = db.collection("lease_offers").doc(currentLeaseOffer.id);
    await offerRef.update({ status: "declined" });

    showTenantMessage("Lease offer declined.", false);
    $("#leaseOfferSection").classList.add("hidden"); // Hide the panel
    currentLeaseOffer = null; // Clear the offer
  } catch (error) {
    console.error("Error declining lease:", error);
    showTenantMessage("Failed to decline offer. Please try again.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Decline Offer";
  }
});

/* ---------------- Announcements Logic (Real-time) ---------------- */

function startAnnouncementListeners() {
  const list = $("#announcementsList");
  if (!tenantProfile?.landlordId) {
    // No landlordId means no active lease, but they could still get an offer
    // Only show this if they ALSO have no pending offers
    if (!currentLeaseOffer) {
      list.innerHTML = `<div class="list-item">No announcements found. You will see announcements here once your landlord assigns you to a property.</div>`;
    }
    return;
  }

  // Stop previous listeners if they exist
  if (specificAnnouncementsUnsub) specificAnnouncementsUnsub();
  if (generalAnnouncementsUnsub) generalAnnouncementsUnsub();

  const announcementsMap = new Map(announcements.map((a) => [a.id, a]));
  let isInitialLoad = true; // To prevent notifying for old messages on load

  // Listener 1: Specific announcements
  try {
    specificAnnouncementsUnsub = db
      .collection("announcements")
      .where("recipientIds", "array-contains", currentUser.uid)
      .onSnapshot(
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const docData = { id: change.doc.id, ...change.doc.data() };
            if (change.type === "added") {
              announcementsMap.set(docData.id, docData);
              if (!isInitialLoad) {
                // Don't notify on the first page load
                showNotification(docData);
              }
            }
            if (change.type === "modified") {
              announcementsMap.set(docData.id, docData);
            }
            if (change.type === "removed") {
              announcementsMap.delete(docData.id);
            }
          });
          renderAnnouncementsList(announcementsMap);
        },
        (error) =>
          console.error("Error on specific announcements snapshot:", error)
      );
  } catch (error) {
    console.error("Error setting up specific announcements listener:", error);
  }

  // Listener 2: General announcements (only if landlordId is present)
  if (tenantProfile.landlordId) {
    try {
      generalAnnouncementsUnsub = db
        .collection("announcements")
        .where("landlordId", "==", tenantProfile.landlordId)
        .where("recipientType", "==", "all") // More specific query
        .onSnapshot(
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              const docData = { id: change.doc.id, ...change.doc.data() };
              // Only add if it's not already in the map from the specific query
              if (!announcementsMap.has(docData.id)) {
                if (change.type === "added") {
                  announcementsMap.set(docData.id, docData);
                  if (!isInitialLoad) {
                    // Don't notify on first load
                    showNotification(docData);
                  }
                }
                if (change.type === "modified") {
                  announcementsMap.set(docData.id, docData);
                }
                if (change.type === "removed") {
                  announcementsMap.delete(docData.id);
                }
              }
            });
            renderAnnouncementsList(announcementsMap);
          },
          (error) =>
            console.error("Error on general announcements snapshot:", error)
        );
    } catch (error) {
      console.error("Error setting up general announcements listener:", error);
    }
  }

  // After a short delay, set initial load to false
  // This grace period prevents old messages from triggering notifications
  setTimeout(() => {
    isInitialLoad = false;
  }, 3000);
}

// Render the main announcements list
function renderAnnouncementsList(announcementsMap) {
  const list = $("#announcementsList");
  announcements = Array.from(announcementsMap.values());
  announcements.sort(
    (a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
  );

  // NEW: Logic to show the latest announcement at the top
  const latestAnnouncement = announcements[0];
  const bar = $("#latestAnnouncementBar");
  if (latestAnnouncement && bar) {
    const dismissedId = localStorage.getItem("dismissedAnnouncementId");

    if (latestAnnouncement.id !== dismissedId) {
      $("#latestAnnouncementTitle").textContent = latestAnnouncement.title;
      $("#latestAnnouncementDetails").textContent = latestAnnouncement.details;
      $("#latestAnnouncementClose").dataset.announcementId =
        latestAnnouncement.id;
      bar.classList.remove("hidden"); // Show the bar
    } else {
      bar.classList.add("hidden"); // Keep it hidden if dismissed
    }
  } else if (bar) {
    bar.classList.add("hidden"); // Hide if no announcements
  }
  // END NEW LOGIC

  if (!announcements.length) {
    list.innerHTML = `<div class="list-item">No announcements from your landlord yet.</div>`;
    return;
  }

  list.innerHTML = announcements
    .map(
      (a) => `
          <div class="list-item">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong>${a.title}</strong>
                  <span class="muted">${fmtDate(a.createdAt)}</span>
              </div>
              <p class="muted" style="margin-top: 8px; white-space: pre-wrap;">${
                a.details
              }</p>
          </div>
      `
    )
    .join("");

  renderRecentAnnouncements(); // NEW: Update dashboard view
}

// NEW: Render Recent Announcements for Dashboard
function renderRecentAnnouncements() {
  const list = $("#recentAnnouncementsList");
  list.innerHTML = "";
  const recent = announcements.slice(0, 3); // Get first 3 from global state

  if (!recent.length) {
    list.innerHTML = `<p class="muted" style="padding: 10px 0;">No recent announcements.</p>`;
    return;
  }

  recent.forEach((a) => {
    const div = document.createElement("div");
    div.className = "recent-list-item";
    div.innerHTML = `
      <div>
        <strong>${a.title}</strong>
        <span class="muted">${fmtDate(a.createdAt)}</span>
      </div>
    `;
    list.appendChild(div);
  });
}

/* ---------------- Profile Editing Logic ---------------- */
const editProfileBtn = $("#editProfileBtn");
const saveProfileBtn = $("#saveProfileBtn");
const cancelEditBtn = $("#cancelEditBtn");

const pName = $("#pName");
const pEmail = $("#pEmail");
const pPhone = $("#pPhone");
const pDob = $("#pDob");
const pAddress = $("#pAddress");
const pNid = $("#pNid");

const pNameInput = $("#pNameInput");
const pEmailInput = $("#pEmailInput");
const pPhoneInput = $("#pPhoneInput");
const pDobInput = $("#pDobInput");
const pAddressInput = $("#pAddressInput");
const pNidInput = $("#pNidInput");

function toggleProfileEditMode(isEditing) {
  // Toggle visibility of buttons
  editProfileBtn.classList.toggle("hidden", isEditing);
  saveProfileBtn.classList.toggle("hidden", !isEditing);
  cancelEditBtn.classList.toggle("hidden", !isEditing);

  // Toggle visibility of text vs. input fields
  [pName, pEmail, pPhone, pDob, pAddress, pNid].forEach((el) =>
    el.classList.toggle("hidden", isEditing)
  );

  [
    pNameInput,
    pEmailInput,
    pPhoneInput,
    pDobInput,
    pAddressInput,
    pNidInput,
  ].forEach((el) => el.classList.toggle("hidden", !isEditing));

  if (isEditing) {
    // When entering edit mode, populate inputs with current data
    pNameInput.value = tenantProfile.fullName || "";
    pEmailInput.value = tenantProfile.email || "";
    pPhoneInput.value = tenantProfile.phone || "";
    pDobInput.value = fmtDateForInput(tenantProfile.dob);
    pAddressInput.value = tenantProfile.address || "";
    pNidInput.value = tenantProfile.nid || "";
  }
}

editProfileBtn.addEventListener("click", () => {
  toggleProfileEditMode(true);
});

cancelEditBtn.addEventListener("click", () => {
  toggleProfileEditMode(false);
});

saveProfileBtn.addEventListener("click", async () => {
  const updates = {
    fullName: pNameInput.value.trim(),
    email: pEmailInput.value.trim(),
    phone: pPhoneInput.value.trim(),
    dob: pDobInput.value,
    address: pAddressInput.value.trim(),
    nid: pNidInput.value.trim(),
  };

  if (!updates.fullName || !updates.email) {
    alert("Full Name and Email are required.");
    return;
  }

  saveProfileBtn.disabled = true;
  saveProfileBtn.textContent = "Saving...";

  try {
    await db.collection("tenants").doc(currentUser.uid).update(updates);
    tenantProfile = { ...tenantProfile, ...updates };
    renderProfileDetails();
    toggleProfileEditMode(false);
  } catch (err) {
    console.error("Error updating profile: ", err);
    showTenantMessage("Failed to update profile. Please try again.", true);
  } finally {
    saveProfileBtn.disabled = false;
    saveProfileBtn.textContent = "Save Changes";
  }
});

/* ---------------- Modals Logic (Non-Profile) ---------------- */
const payDialog = $("#payDialog");
const maintDialog = $("#maintDialog");
const propertyDetailsModal = $("#propertyDetailsModal");
const paySubmitBtn = $("#paySubmit");

let payDialogLease = null;
function openPayDialog(lease) {
  payDialogLease = lease;
  $("#payLeaseLabel").textContent = lease.propertyIdentifier || "Lease";
  $("#payAmount").value = lease.rentAmount || "";

  // MODIFIED: Default to today's date for simulation
  $("#payForDate").value = new Date().toISOString().split("T")[0];

  payDialog.showModal();
}

$("#cancelPay").addEventListener("click", () => payDialog.close());

/* ---------------- MODIFIED: Pay Form Submit Logic ---------------- */
$("#payForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!payDialogLease) return;

  paySubmitBtn.disabled = true;
  paySubmitBtn.textContent = "Processing...";

  // NEW: Get payment method and generate TXN ID
  const paymentMethod = $('#payForm input[name="paymentMethod"]:checked').value;
  const transactionId = generateTxId(paymentMethod);

  const paymentData = {
    tenantId: currentUser.uid,
    landlordId: payDialogLease.landlordId,
    propertyId: payDialogLease.propertyId,
    amountPaid: Number($("#payAmount").value),
    paymentDate: firebase.firestore.FieldValue.serverTimestamp(),
    paymentForMonth: new Date($("#payForDate").value), // Store which month/date this is for
    status: "successful", // Mark as successful for simulation
    paymentMethod: paymentMethod, // NEW
    transactionId: transactionId, // NEW
  };

  try {
    // 1. Save payment to Firestore
    await db.collection("payments").add(paymentData);

    // 2. Close modal and reset form
    payDialog.close();
    $("#payForm").reset();

    // 3. Show success message
    showTenantMessage("Payment successful! (Simulation)", false);

    // 4. Refresh the payments list
    await loadPayments();
  } catch (error) {
    console.error("Error submitting payment:", error);
    showTenantMessage("Payment failed. Please try again.", true);
  } finally {
    paySubmitBtn.disabled = false;
    paySubmitBtn.textContent = "Submit Payment";
  }
});

let maintDialogLease = null;
function openMaintDialog(lease) {
  maintDialogLease = lease;
  $("#maintLeaseLabel").textContent = lease.propertyIdentifier || "Lease";
  maintDialog.showModal();
}

$("#cancelMaint").addEventListener("click", () => maintDialog.close());
$("#maintForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!maintDialogLease) return;

  const maintSubmitBtn = $("#maintSubmit");
  maintSubmitBtn.disabled = true;
  maintSubmitBtn.textContent = "Submitting...";

  const title = $("#maintTitle").value.trim();
  const details = $("#maintDetails").value.trim();
  if (!title || !details) return;

  const payload = {
    tenantId: currentUser.uid,
    landlordId: maintDialogLease.landlordId,
    propertyId: maintDialogLease.propertyId,
    title,
    details,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    technicianId: "", // Initialize empty
    technicianName: "", // Initialize empty
  };

  try {
    await db.collection("maintenance_requests").add(payload);
    maintDialog.close();
    $("#maintForm").reset();
    showTenantMessage("Maintenance request submitted successfully.", false);
    loadMaintenance();
  } catch (err) {
    console.error(err);
    showTenantMessage("Failed to submit request.", true);
  } finally {
    maintSubmitBtn.disabled = false;
    maintSubmitBtn.textContent = "Submit";
  }
});

$("#newMaintBtn").addEventListener("click", () => {
  if (!leases.length) {
    showTenantMessage("No leases available to submit a request for.", true);
    return;
  }
  // Find the first lease from the tenantProfile
  const activeLease = leases[0];
  const leaseForButton = {
    propertyId: activeLease.propertyId,
    landlordId: activeLease.landlordId,
    rentAmount: activeLease.rentAmount,
    propertyIdentifier: $("#nextDueLease").textContent.replace("For ", ""), // Re-use identifier from dash
  };
  openMaintDialog(leaseForButton);
});

$("#leasesList").addEventListener("click", async (e) => {
  const btn = e.target.closest('button[data-action="details"]');
  if (btn) {
    const propertyId = btn.dataset.propertyId;
    if (propertyId) {
      try {
        const propDoc = await db.collection("properties").doc(propertyId).get();
        if (propDoc.exists) {
          showPropertyDetails(propDoc.data());
        } else {
          showTenantMessage("Property details not found.", true);
        }
      } catch (error) {
        console.error("Error fetching property details:", error);
        showTenantMessage("Could not fetch property details.", true);
      }
    }
  }
});

function showPropertyDetails(prop) {
  $("#detailsAddress").textContent = prop.address;
  $("#detailsName").textContent = prop.propertyName || "—";
  $("#detailsUnit").textContent = prop.unit || "—";
  $("#detailsRent").textContent = fmtMoney(prop.rentAmount);
  $("#detailsBedrooms").textContent = prop.bedrooms || "—";
  $("#detailsBathrooms").textContent = prop.bathrooms || "—";
  $("#detailsSqft").textContent = prop.sqft ? `${prop.sqft} sqft` : "—";
  $("#detailsOther").textContent =
    prop.details || "No additional details provided.";
  propertyDetailsModal.showModal();
}

$("#closeDetailsBtn").addEventListener("click", () => {
  propertyDetailsModal.close();
});

/* ---------------- Logout ---------------- */
$("#logoutBtn").addEventListener("click", async () => {
  // NEW: Unsubscribe from listeners on logout
  if (specificAnnouncementsUnsub) specificAnnouncementsUnsub();
  if (generalAnnouncementsUnsub) generalAnnouncementsUnsub();
  if (leaseOfferUnsub) leaseOfferUnsub(); // Unsubscribe from lease offer listener

  await auth.signOut();
  window.location.href = "auth.html";
});
