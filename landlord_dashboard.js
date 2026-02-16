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
  n == null || n === 0 ? "—" : `৳${Number(n).toLocaleString("en-BD")}`;
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
const fmtMonthYear = (d) => {
  if (!d) return "—";
  const dt = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

/* ---------------- Modal Refs ---------------- */
const addTenantModal = $("#addTenantModal");
const addPropertyModal = $("#addPropertyModal");
const propertyDetailsModal = $("#propertyDetailsModal");
const addAnnouncementModal = $("#addAnnouncementModal");
const specificTenantsListWrapper = $("#specificTenantsListWrapper");
const addTechnicianModal = $("#addTechnicianModal");
const addTechnicianForm = $("#addTechnicianForm");
const technicianModalTitle = $("#technicianModalTitle");
const technicianIdInput = $("#technicianId");
const maintenanceDetailsModal = $("#maintenanceDetailsModal");
const updateMaintenanceForm = $("#updateMaintenanceForm");
// NEW: Tenant Details Modal Ref
const tenantDetailsModal = $("#tenantDetailsModal");
// NEW: Confirmation Modal Refs
const confirmDialog = $("#confirmDialog");
const confirmTitle = $("#confirmTitle");
const confirmMessage = $("#confirmMessage");
const confirmOkBtn = $("#confirmOkBtn");
const confirmCancelBtn = $("#confirmCancelBtn");

/* ---------------- Profile Refs ---------------- */
const editProfileBtn = $("#editProfileBtn");
const saveProfileBtn = $("#saveProfileBtn");
const cancelEditBtn = $("#cancelEditBtn");
const pName = $("#pName");
const pPhone = $("#pPhone");
const pNameInput = $("#pNameInput");
const pPhoneInput = $("#pPhoneInput");
const pEmail = $("#pEmail");
const pEmailInput = $("#pEmailInput");
const pNid = $("#pNid");
const pNidInput = $("#pNidInput");
const pDob = $("#pDob");
const pDobInput = $("#pDobInput");

/* ---------------- State ---------------- */
let currentUser = null;
let landlordProfile = null;
let properties = [];
let tenants = [];
let maintenanceRequests = [];
let announcements = [];
let technicians = [];
let payments = [];
let verifiedTenant = null;
let itemToRemove = null; // NEW: State for item to be removed

/* ---------------- Auth guard (landlord only) ---------------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = user;

  try {
    const lDoc = await db.collection("landlords").doc(user.uid).get();
    if (!lDoc.exists) {
      const tDoc = await db.collection("tenants").doc(user.uid).get();
      if (tDoc.exists) {
        window.location.href = "tenant_dashboard.html";
      } else {
        await auth.signOut();
        window.location.href = "auth.html";
      }
      return;
    }

    landlordProfile = { uid: user.uid, ...lDoc.data() };
    $("#landlordName").textContent = landlordProfile.fullName || "Landlord";
    pName.textContent = landlordProfile.fullName || "—";
    pEmail.textContent = landlordProfile.email || user.email || "—";
    pPhone.textContent = landlordProfile.phone || "—";
    pNid.textContent = landlordProfile.nid || "—";
    pDob.textContent = landlordProfile.dob ? fmtDate(landlordProfile.dob) : "—";
    $("#pCreated").textContent = fmtDate(landlordProfile.createdAt);

    await loadData();
    setupConfirmModalListeners(); // NEW: Setup confirmation modal
  } catch (e) {
    console.error(e);
    alert("Unable to load landlord dashboard.");
  }
});

async function loadData() {
  await loadProperties();
  await loadTenants();
  await loadTechnicians();
  await loadMaintenanceRequests();
  await loadAnnouncements();
  await loadPayments();
  renderDashboardActions();
}

/* ---------------- Load Properties ---------------- */
async function loadProperties() {
  properties = [];
  const propSnap = await db
    .collection("properties")
    .where("landlordId", "==", currentUser.uid)
    .get();
  propSnap.forEach((d) => properties.push({ id: d.id, ...d.data() }));

  const totalRent = properties.reduce(
    (acc, p) => acc + (Number(p.rentAmount) || 0),
    0
  );
  const totalProperties = properties.length;
  const occupiedProperties = properties.filter((p) => p.occupants > 0).length;
  const occupancyRate =
    totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

  $("#totalProperties").textContent = totalProperties;
  $("#monthlyRentCollected").textContent = fmtMoney(totalRent);
  $("#occupancyRate").textContent = `${occupancyRate.toFixed(0)}%`;
  $(
    "#occupancyMeta"
  ).textContent = `${occupiedProperties} / ${totalProperties} units`;

  renderProperties();
}

/* ---------------- Render Properties ---------------- */
function renderProperties() {
  const grid = $("#propertiesGrid");
  grid.innerHTML = "";

  if (!properties.length) {
    grid.innerHTML = `<div class="list-item" style="grid-column: 1 / -1;">You haven't added any properties yet. Click "Add Property" to get started.</div>`;
    return;
  }

  properties.forEach((p) => {
    const div = document.createElement("div");
    div.className = "card";
    // MODIFIED: Added Remove button
    div.innerHTML = `
          <div class="card-label" style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${
            p.propertyName || p.address
          }</div>
           <div class="card-meta" style="font-size: 14px;">${p.address} ${
      p.unit ? `(Unit ${p.unit})` : ""
    }</div>
          <div class="card-value">${fmtMoney(p.rentAmount)}</div>
          <div class="card-meta">
              ${p.bedrooms || "N/A"} beds • ${p.bathrooms || "N/A"} baths
          </div>
          <div class="qa-actions">
              <button class="btn" data-action="details" data-property-id="${
                p.id
              }">Details</button>
              <button class="btn ghost danger" data-action="remove" data-property-id="${
                p.id
              }">Remove</button>
          </div>
          `;
    grid.appendChild(div);
  });
}

/* ---------------- Add/View/Remove Property Logic ---------------- */
$("#addPropertyBtn").addEventListener("click", () => {
  addPropertyModal.showModal();
});

$("#cancelAddPropertyBtn").addEventListener("click", () => {
  addPropertyModal.close();
  $("#addPropertyForm").reset();
});

addPropertyModal.addEventListener("close", () => {
  $("#addPropertyForm").reset();
});

$("#addPropertyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const propertyData = {
    landlordId: currentUser.uid,
    propertyName: $("#propertyName").value,
    unit: $("#propertyUnit").value,
    address: $("#propertyAddress").value,
    rentAmount: Number($("#propertyRent").value) || 0,
    bedrooms: Number($("#propertyBedrooms").value) || 0,
    bathrooms: Number($("#propertyBathrooms").value) || 0,
    sqft: Number($("#propertySqft").value) || 0,
    details: $("#propertyDetails").value || "",
    occupants: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection("properties").add(propertyData);
    addPropertyModal.close();
    await loadProperties();
  } catch (error) {
    console.error("Error adding property: ", error);
    alert("Failed to add property. Please try again.");
  }
});

// MODIFIED: Event listener for Details and Remove buttons
$("#propertiesGrid").addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;

  const propertyId = button.dataset.propertyId;
  const action = button.dataset.action;

  if (action === "details" && propertyId) {
    const prop = properties.find((p) => p.id === propertyId);
    if (prop) {
      showPropertyDetails(prop);
    }
  } else if (action === "remove" && propertyId) {
    const prop = properties.find((p) => p.id === propertyId);
    if (prop) {
      // NEW: Open confirmation dialog for removing property
      confirmRemoveProperty(prop);
    }
  }
});

// NEW: Function to delete property
async function deleteProperty(propertyId) {
  // Check if any tenants are assigned to this property
  const tenantsInProperty = tenants.filter((t) => t.propertyId === propertyId);
  if (tenantsInProperty.length > 0) {
    alert("Cannot delete property. Please remove or reassign tenants first.");
    return;
  }

  try {
    await db.collection("properties").doc(propertyId).delete();
    await loadProperties(); // Refresh properties list
  } catch (error) {
    console.error("Error removing property:", error);
    alert("Failed to remove property.");
  }
}

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

/* ---------------- Dashboard Actions ---------------- */
function renderDashboardActions() {
  const wrap = $("#dashboardActions");
  wrap.innerHTML = `
      <div class="card">
        <div class="card-title">Add Property</div>
        <div class="card-desc">Add a new unit or building to your portfolio.</div>
        <button class="btn primary" id="quickAddProperty">Add Property</button>
      </div>
      <div class="card">
        <div class="card-title">Add Tenant</div>
        <div class="card-desc">Onboard a new tenant and assign them to a lease.</div>
        <button class="btn primary" id="quickAddTenant">Add Tenant</button>
      </div>
      <div class="card">
        <div class="card-title">Create Announcement</div>
        <div class="card-desc">Send a message to all or specific tenants.</div>
        <button class="btn" id="quickAddAnnouncement">Create</button>
      </div>
      <div class="card">
        <div class="card-title">Add Technician</div>
        <div class="card-desc">Add a new contact for maintenance work.</div>
        <button class="btn" id="quickAddTechnician">Add Technician</button>
      </div>
  `;
  // Add event listeners for the new buttons
  $("#quickAddProperty").addEventListener("click", () => {
    addPropertyModal.showModal();
  });
  $("#quickAddTenant").addEventListener("click", () => {
    addTenantModal.showModal();
  });
  $("#quickAddAnnouncement").addEventListener("click", () => {
    populateTenantSelector();
    addAnnouncementModal.showModal();
  });
  $("#quickAddTechnician").addEventListener("click", () => {
    addTechnicianForm.reset();
    technicianIdInput.value = "";
    technicianModalTitle.textContent = "Add Technician";
    addTechnicianModal.showModal();
  });
}

/* ---------------- Sidebar navigation ---------------- */
$$(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    const sectionName = link.dataset.section;
    $$(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    $$(".section").forEach((s) => s.classList.remove("active"));
    const sectionToShow = $(`#section-${sectionName}`);
    if (sectionToShow) sectionToShow.classList.add("active");
  });
});

/* ---------------- Tenants list ---------------- */
async function loadTenants() {
  const list = $("#tenantsList");
  list.innerHTML = "";

  tenants = [];
  const tenantSnap = await db
    .collection("tenants")
    .where("landlordId", "==", currentUser.uid)
    .get();
  tenantSnap.forEach((d) => tenants.push({ id: d.id, ...d.data() }));

  $("#totalTenants").textContent = tenants.length;

  if (!tenants.length) {
    list.innerHTML = `<div class="list-item">No tenants found.</div>`;
    return;
  }

  tenants.forEach((t) => {
    const property = properties.find((p) => p.id === t.propertyId);
    const propertyIdentifier = property
      ? `${property.propertyName} (Unit ${property.unit || "N/A"})`
      : "Not Assigned";
    const div = document.createElement("div");
    // MODIFIED: Added tenant-item class and Remove button
    div.className = "list-item tenant-item";
    div.innerHTML = `
          <div class="tenant-info">
              <h4>${t.fullName || "Tenant"}</h4>
              <p class="muted">${t.email || "—"}</p>
          </div>
          <div class="tenant-lease-info">
              <p><strong>Property:</strong> ${propertyIdentifier}</p>
              <p><strong>Rent:</strong> ${fmtMoney(t.rentAmount)}</p>
          </div>
           <div class="tenant-actions">
              <!-- NEW BUTTON ADDED HERE -->
              <button class="btn" data-action="details" data-tenant-id="${
                t.id
              }">Details</button>
              <button class="btn ghost danger" data-action="remove" data-tenant-id="${
                t.id
              }" data-property-id="${t.propertyId || ""}">Remove</button>
           </div>
      `;
    list.appendChild(div);
  });
}

// NEW: Event listener for removing tenants AND viewing details
$("#tenantsList").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]"); // Find closest button with data-action
  if (!button) return;

  const action = button.dataset.action;
  const tenantId = button.dataset.tenantId;

  if (action === "remove") {
    const propertyId = button.dataset.propertyId;
    const tenant = tenants.find((t) => t.id === tenantId);

    if (tenant) {
      confirmRemoveTenant(tenant, propertyId);
    }
  } else if (action === "details") {
    // NEW: Handle details action
    if (tenantId) {
      openTenantDetailsModal(tenantId);
    }
  }
});

// NEW: Function to open Tenant Details Modal
async function openTenantDetailsModal(tenantId) {
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) {
    alert("Tenant details not found.");
    return;
  }

  const property = properties.find((p) => p.id === tenant.propertyId);
  const propertyIdentifier = property
    ? `${property.propertyName} (Unit ${property.unit || "N/A"})`
    : "Not Assigned";

  // 1. Populate Tenant & Lease Details
  $("#tenantDetailsName").textContent = tenant.fullName || "Tenant Details";
  $("#tenantDetailsEmail").textContent = tenant.email || "—";
  $("#tenantDetailsPhone").textContent = tenant.phone || "—";
  $("#tenantDetailsNid").textContent = tenant.nid || "—";
  $("#tenantDetailsDob").textContent = tenant.dob ? fmtDate(tenant.dob) : "—";
  $("#tenantDetailsAddress").textContent = tenant.address || "—";

  $("#tenantDetailsProperty").textContent = propertyIdentifier;
  $("#tenantDetailsRent").textContent = fmtMoney(tenant.rentAmount);
  $("#tenantDetailsLeaseStart").textContent = tenant.leaseDate
    ? fmtDate(tenant.leaseDate)
    : "—";
  $("#tenantDetailsLeaseEnd").textContent = tenant.leaseExpiryDate
    ? fmtDate(tenant.leaseExpiryDate)
    : "—";
  $("#tenantDetailsAdvance").textContent = fmtMoney(tenant.advancePayment);
  $("#tenantDetailsDueDay").textContent = tenant.rentPayDate
    ? `Day ${tenant.rentPayDate} of month`
    : "—";

  // 2. Clear and load payment history
  const paymentList = $("#tenantPaymentHistoryList");
  paymentList.innerHTML = `<div class="list-item">Loading payment history...</div>`;

  tenantDetailsModal.showModal(); // Show modal early so user sees loading state

  try {
    const tenantPayments = [];
    const snap = await db
      .collection("payments")
      .where("tenantId", "==", tenantId)
      .get();

    snap.forEach((doc) => {
      tenantPayments.push({ id: doc.id, ...doc.data() });
    });

    // Sort by payment date, newest first
    tenantPayments.sort(
      (a, b) => (b.paymentDate?.toDate() || 0) - (a.paymentDate?.toDate() || 0)
    );

    if (!tenantPayments.length) {
      paymentList.innerHTML = `<div class="list-item">No payment history found for this tenant.</div>`;
      return;
    }

    paymentList.innerHTML = ""; // Clear loading

    tenantPayments.forEach((p) => {
      const div = document.createElement("div");
      div.className = "list-item payment-item"; // Reuse existing payment item style
      div.style.gridTemplateColumns = "1fr auto auto"; // Adjust grid for modal
      // MODIFIED: Added Method and TXN ID
      div.innerHTML = `
              <div class="payment-info">
                <strong class="payment-amount">${fmtMoney(
                  p.amountPaid
                )}</strong>
                <span class="muted">
                  Paid On: <strong>${fmtDate(p.paymentDate)}</strong>
                </span>
                <span class="muted" style="margin-top: 4px;">
                  Method: <strong>${p.paymentMethod || "N/A"}</strong>
                </span>
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
      paymentList.appendChild(div);
    });
  } catch (error) {
    console.error("Error fetching tenant payment history:", error);
    paymentList.innerHTML = `<div class="list-item" style="color: var(--danger-color);">Failed to load payment history.</div>`;
  }
}

// NEW: Add close listener for tenant details modal
$("#closeTenantDetailsBtn").addEventListener("click", () => {
  tenantDetailsModal.close();
});

// NEW: Function to delete tenant and update property occupancy
async function deleteTenant(tenantId, propertyId) {
  try {
    const tenantRef = db.collection("tenants").doc(tenantId);
    // Use Firestore transaction for atomicity
    await db.runTransaction(async (transaction) => {
      // 1. Mark tenant for deletion (or fully delete if preferred)
      // Here we update to remove lease details instead of full delete
      transaction.update(tenantRef, {
        landlordId: firebase.firestore.FieldValue.delete(),
        propertyId: firebase.firestore.FieldValue.delete(),
        leaseDate: firebase.firestore.FieldValue.delete(),
        leaseExpiryDate: firebase.firestore.FieldValue.delete(),
        rentAmount: firebase.firestore.FieldValue.delete(),
        advancePayment: firebase.firestore.FieldValue.delete(),
        rentPayDate: firebase.firestore.FieldValue.delete(),
      });

      // 2. Decrement occupants count if propertyId exists
      if (propertyId) {
        const propertyRef = db.collection("properties").doc(propertyId);
        transaction.update(propertyRef, {
          occupants: firebase.firestore.FieldValue.increment(-1),
        });
      }
    });

    await loadTenants(); // Refresh tenant list
    await loadProperties(); // Refresh properties to update occupancy stats
  } catch (error) {
    console.error("Error removing tenant:", error);
    alert("Failed to remove tenant.");
  }
}

/* ---------------- Payments Logic ---------------- */
async function loadPayments() {
  payments = [];
  const snap = await db
    .collection("payments")
    .where("landlordId", "==", currentUser.uid)
    .get();
  snap.forEach((doc) => {
    payments.push({ id: doc.id, ...doc.data() });
  });

  // Sort by payment date, newest first
  payments.sort(
    (a, b) => (b.paymentDate?.toDate() || 0) - (a.paymentDate?.toDate() || 0)
  );

  // Update dashboard card
  const totalReceived = payments.reduce(
    (acc, p) => acc + (Number(p.amountPaid) || 0),
    0
  );
  $("#totalPaymentsReceived").textContent = fmtMoney(totalReceived);

  renderPayments();
  renderRecentPayments();
}

function renderPayments() {
  const list = $("#paymentsList");
  list.innerHTML = "";

  if (!payments.length) {
    list.innerHTML = `<div class="list-item">No payments received yet.</div>`;
    return;
  }

  for (const p of payments) {
    const tenant = tenants.find((t) => t.id === p.tenantId);
    const property = properties.find((prop) => prop.id === p.propertyId);

    const tenantName = tenant ? tenant.fullName : "Unknown Tenant";
    const propertyIdentifier = property
      ? `${property.propertyName} (Unit ${property.unit || "N/A"})`
      : "Unknown Property";

    const div = document.createElement("div");
    div.className = "list-item payment-item";
    // MODIFIED: Added Payment Method and TXN ID
    div.innerHTML = `
      <div class="payment-info">
        <strong class="payment-amount">${fmtMoney(p.amountPaid)}</strong>
        <span class="muted">
          From: <strong>${tenantName}</strong>
        </span>
        <span class="muted">
          For: ${propertyIdentifier}
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
    `;
    list.appendChild(div);
  }
}

function renderRecentPayments() {
  const list = $("#recentPaymentsList");
  list.innerHTML = "";
  const recent = payments.slice(0, 3);

  if (!recent.length) {
    list.innerHTML = `<p class="muted" style="padding: 10px 0;">No recent payments.</p>`;
    return;
  }

  recent.forEach((p) => {
    const tenant = tenants.find((t) => t.id === p.tenantId);
    const tenantName = tenant ? tenant.fullName : "Unknown";

    const div = document.createElement("div");
    div.className = "recent-list-item";
    // MODIFIED: Added Payment Method
    div.innerHTML = `
      <div>
        <strong>${tenantName}</strong>
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

/* ---------------- Maintenance Requests ---------------- */
async function loadMaintenanceRequests() {
  const list = $("#maintenanceList");
  list.innerHTML = "";
  maintenanceRequests = [];
  const maintSnap = await db
    .collection("maintenance_requests")
    .where("landlordId", "==", currentUser.uid)
    .get();
  maintSnap.forEach((doc) => {
    maintenanceRequests.push({ id: doc.id, ...doc.data() });
  });

  maintenanceRequests.sort(
    (a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
  );

  $("#pendingMaintenance").textContent = maintenanceRequests.filter(
    (r) => r.status === "open" || r.status === "in-progress"
  ).length;

  if (!maintenanceRequests.length) {
    list.innerHTML = `<div class="list-item">No maintenance requests found.</div>`;
    return;
  }

  for (const req of maintenanceRequests) {
    const tenant = tenants.find((t) => t.id === req.tenantId);
    const property = properties.find((p) => p.id === req.propertyId);
    const propertyIdentifier = property
      ? `${property.propertyName} (Unit ${property.unit || "N/A"})`
      : "N/A";
    const status = req.status || "open";

    const div = document.createElement("div");
    div.className = "list-item maintenance-item";
    div.innerHTML = `
      <div class="maintenance-info">
        <strong>${req.title}</strong>
        <span class="muted">
          Tenant: ${tenant ? tenant.fullName : "N/A"}
        </span>
        <span class="muted">
          Property: ${propertyIdentifier}
        </span>
      </div>
      <div class="maintenance-assignment">
        <span class="status-badge ${status}">
          ${status.replace("-", " ")}
        </span>
        <span class="muted" style="font-size: 13px;">
          Technician: ${req.technicianName || "None"}
        </span>
      </div>
      <div class="maintenance-actions">
        <button class="btn" data-action="open-maint" data-request-id="${
          req.id
        }">View</button>
      </div>
    `;
    list.appendChild(div);
  }

  renderRecentMaintenance();
}

function renderRecentMaintenance() {
  const list = $("#recentMaintenanceList");
  list.innerHTML = "";
  const recentOpen = maintenanceRequests
    .filter((r) => r.status === "open" || r.status === "in-progress")
    .slice(0, 3);

  if (!recentOpen.length) {
    list.innerHTML = `<p class="muted" style="padding: 10px 0;">No open maintenance requests.</p>`;
    return;
  }

  recentOpen.forEach((req) => {
    const tenant = tenants.find((t) => t.id === req.tenantId);
    const tenantName = tenant ? tenant.fullName : "Unknown";
    const status = req.status || "open";

    const div = document.createElement("div");
    div.className = "recent-list-item";
    div.innerHTML = `
      <div>
        <strong>${req.title}</strong>
        <span class="muted">From: ${tenantName}</span>
      </div>
      <span class="status-badge ${status}">${status.replace("-", " ")}</span>
    `;
    list.appendChild(div);
  });
}

$("#maintenanceList").addEventListener("click", (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  if (target.dataset.action === "open-maint") {
    openMaintenanceDetailsModal(target.dataset.requestId);
  }
});

function openMaintenanceDetailsModal(id) {
  const req = maintenanceRequests.find((r) => r.id === id);
  if (!req) return;

  const tenant = tenants.find((t) => t.id === req.tenantId);
  const property = properties.find((p) => p.id === req.propertyId);

  $("#maintenanceModalTitle").textContent = `Request: ${req.title}`;
  $("#maintModalTenant").textContent = tenant ? tenant.fullName : "N/A";
  $("#maintModalProperty").textContent = property
    ? `${property.propertyName} (Unit ${property.unit || "N/A"})`
    : "N/A";
  $("#maintModalReported").textContent = fmtDate(req.createdAt);
  $("#maintModalIssueTitle").textContent = req.title;
  $("#maintModalIssueDetails").textContent = req.details;

  $("#maintenanceRequestId").value = id;
  $("#updateStatusSelect").value = req.status || "open";

  const techSelect = $("#assignTechnicianSelect");
  techSelect.innerHTML = '<option value="">None</option>';
  technicians.forEach((tech) => {
    techSelect.innerHTML += `
      <option value="${tech.id}">${tech.name} (${tech.role})</option>
    `;
  });
  techSelect.value = req.technicianId || "";

  maintenanceDetailsModal.showModal();
}

$("#cancelUpdateMaintenanceBtn").addEventListener("click", () => {
  maintenanceDetailsModal.close();
});

updateMaintenanceForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = $("#maintenanceRequestId").value;
  const newStatus = $("#updateStatusSelect").value;
  const newTechnicianId = $("#assignTechnicianSelect").value;

  const tech = technicians.find((t) => t.id === newTechnicianId);
  const newTechnicianName = tech ? tech.name : "";

  const updates = {
    status: newStatus,
    technicianId: newTechnicianId,
    technicianName: newTechnicianName,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const btn = updateMaintenanceForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";

    await db.collection("maintenance_requests").doc(id).update(updates);

    maintenanceDetailsModal.close();
    await loadMaintenanceRequests();
  } catch (error) {
    console.error("Error updating maintenance request: ", error);
    alert("Failed to update request.");
  } finally {
    const btn = updateMaintenanceForm.querySelector('button[type="submit"]');
    btn.disabled = false;
    btn.textContent = "Save Changes";
  }
});

/* ---------------- Announcements Logic ---------------- */
async function loadAnnouncements() {
  const list = $("#announcementsList");
  list.innerHTML = "";
  announcements = [];
  const snap = await db
    .collection("announcements")
    .where("landlordId", "==", currentUser.uid)
    .get();
  snap.forEach((doc) => announcements.push({ id: doc.id, ...doc.data() }));

  announcements.sort(
    (a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
  );

  renderAnnouncements();
}

function renderAnnouncements() {
  const list = $("#announcementsList");
  if (!announcements.length) {
    list.innerHTML = `<div class="list-item">You have not sent any announcements.</div>`;
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
}

function populateTenantSelector() {
  specificTenantsListWrapper.innerHTML = "";
  if (!tenants.length) {
    specificTenantsListWrapper.innerHTML = `<p class="muted">No tenants found to select from.</p>`;
    return;
  }

  tenants.forEach((t) => {
    const property = properties.find((p) => p.id === t.propertyId);
    const address = property
      ? `${property.propertyName} - Unit ${property.unit || "N/A"}`
      : "Unassigned";
    const div = document.createElement("div");
    div.innerHTML = `
      <label style="display: flex; align-items: center; gap: 8px; font-weight: normal; margin: 8px 0;">
        <input type="checkbox" value="${
          t.id
        }" class="tenant-select-checkbox" style="width: auto;">
        <span>${
          t.fullName || "Tenant"
        } (<span class="muted">${address}</span>)</span>
      </label>
    `;
    specificTenantsListWrapper.appendChild(div);
  });
}

document.querySelectorAll('input[name="recipientType"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "specific") {
      specificTenantsListWrapper.classList.remove("hidden");
    } else {
      specificTenantsListWrapper.classList.add("hidden");
    }
  });
});

$("#addAnnouncementBtn").addEventListener("click", () => {
  populateTenantSelector();
  addAnnouncementModal.showModal();
});

$("#cancelAddAnnouncementBtn").addEventListener("click", () => {
  addAnnouncementModal.close();
});

addAnnouncementModal.addEventListener("close", () => {
  $("#addAnnouncementForm").reset();
  document.querySelector(
    'input[name="recipientType"][value="all"]'
  ).checked = true;
  specificTenantsListWrapper.classList.add("hidden");
});

$("#addAnnouncementForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#announcementTitle").value.trim();
  const details = $("#announcementDetails").value.trim();
  const recipientType = document.querySelector(
    'input[name="recipientType"]:checked'
  ).value;

  if (!title || !details) {
    alert("Please fill out both title and details.");
    return;
  }

  const payload = {
    landlordId: currentUser.uid,
    title,
    details,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    recipientType: recipientType,
  };

  if (recipientType === "specific") {
    const selectedTenants = [
      ...document.querySelectorAll(".tenant-select-checkbox:checked"),
    ].map((cb) => cb.value);
    if (selectedTenants.length === 0) {
      alert("Please select at least one tenant.");
      return;
    }
    payload.recipientIds = selectedTenants;
  }

  try {
    await db.collection("announcements").add(payload);
    addAnnouncementModal.close();
    await loadAnnouncements();
  } catch (error) {
    console.error("Error adding announcement: ", error);
    alert("Failed to send announcement.");
  }
});

/* ---------------- Profile Editing Logic ---------------- */
function toggleProfileEditMode(isEditing) {
  editProfileBtn.classList.toggle("hidden", isEditing);
  saveProfileBtn.classList.toggle("hidden", !isEditing);
  cancelEditBtn.classList.toggle("hidden", !isEditing);

  pName.classList.toggle("hidden", isEditing);
  pEmail.classList.toggle("hidden", isEditing);
  pPhone.classList.toggle("hidden", isEditing);
  pNid.classList.toggle("hidden", isEditing);
  pDob.classList.toggle("hidden", isEditing);

  pNameInput.classList.toggle("hidden", !isEditing);
  pEmailInput.classList.toggle("hidden", !isEditing);
  pPhoneInput.classList.toggle("hidden", !isEditing);
  pNidInput.classList.toggle("hidden", !isEditing);
  pDobInput.classList.toggle("hidden", !isEditing);

  if (isEditing) {
    pNameInput.value = landlordProfile.fullName || "";
    pEmailInput.value = landlordProfile.email || "";
    pPhoneInput.value = landlordProfile.phone || "";
    pNidInput.value = landlordProfile.nid || "";
    pDobInput.value = landlordProfile.dob || "";
  }
}

editProfileBtn.addEventListener("click", () => {
  toggleProfileEditMode(true);
});

cancelEditBtn.addEventListener("click", () => {
  toggleProfileEditMode(false);
});

saveProfileBtn.addEventListener("click", async () => {
  const newFullName = pNameInput.value.trim();
  const newEmail = pEmailInput.value.trim();
  const newPhone = pPhoneInput.value.trim();
  const newNid = pNidInput.value.trim();
  const newDob = pDobInput.value.trim();

  if (!newFullName || !newEmail) {
    alert("Full Name and Email cannot be empty.");
    return;
  }

  const updates = {
    fullName: newFullName,
    email: newEmail,
    phone: newPhone,
    nid: newNid,
    dob: newDob,
  };

  saveProfileBtn.disabled = true;
  saveProfileBtn.textContent = "Saving...";

  try {
    await db.collection("landlords").doc(currentUser.uid).update(updates);
    landlordProfile.fullName = newFullName;
    landlordProfile.email = newEmail;
    landlordProfile.phone = newPhone;
    landlordProfile.nid = newNid;
    landlordProfile.dob = newDob;

    $("#landlordName").textContent = newFullName || "Landlord";
    pName.textContent = newFullName || "—";
    pEmail.textContent = newEmail || "—";
    pPhone.textContent = newPhone || "—";
    pNid.textContent = newNid || "—";
    pDob.textContent = newDob ? fmtDate(newDob) : "—";

    toggleProfileEditMode(false);
  } catch (error) {
    console.error("Error updating profile: ", error);
    alert("Failed to update profile. Please try again.");
  } finally {
    saveProfileBtn.disabled = false;
    saveProfileBtn.textContent = "Save Changes";
  }
});

/* ---------------- Add Tenant Modal Logic ---------------- */
const verifyTenantForm = $("#verifyTenantForm");
const addLeaseSection = $("#addLeaseSection");
const addLeaseForm = $("#addLeaseForm");
const propertySelect = $("#propertySelect");

$("#addTenantBtn").addEventListener("click", () => {
  addTenantModal.showModal();
});

function closeAddTenantModal() {
  addTenantModal.close();
}

$("#cancelVerifyBtn").addEventListener("click", closeAddTenantModal);
$("#cancelLeaseBtn").addEventListener("click", closeAddTenantModal);
addTenantModal.addEventListener("close", () => {
  resetAddTenantForm();
});

verifyTenantForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#tenantEmail").value;
  const phone = $("#tenantPhone").value;

  const tenantQuery = await db
    .collection("tenants")
    .where("email", "==", email)
    .where("phone", "==", phone)
    .get();

  if (tenantQuery.empty) {
    alert("Tenant not found.");
    return;
  }

  verifiedTenant = {
    id: tenantQuery.docs[0].id,
    ...tenantQuery.docs[0].data(),
  };

  // Check if tenant already has a landlordId (is already assigned)
  if (verifiedTenant.landlordId) {
    alert(
      "This tenant is already associated with a lease. Please remove their current lease first."
    );
    resetAddTenantForm();
    return;
  }

  $("#verifiedTenantInfo").textContent = `Name: ${verifiedTenant.fullName}`;
  addLeaseSection.classList.remove("hidden");
  verifyTenantForm.classList.add("hidden");

  // Filter properties to show only unoccupied ones
  const availableProperties = properties.filter(
    (p) => !p.occupants || p.occupants === 0
  );

  if (availableProperties.length === 0) {
    propertySelect.innerHTML =
      '<option value="" disabled>No available properties</option>';
    // Disable form submission
    addLeaseForm.querySelector('button[type="submit"]').disabled = true;
  } else {
    propertySelect.innerHTML = availableProperties
      .map(
        (p) =>
          `<option value="${p.id}">${p.propertyName} - Unit ${
            p.unit || "N/A"
          }</option>`
      )
      .join("");
    addLeaseForm.querySelector('button[type="submit"]').disabled = false;
  }
});

// MODIFIED: addLeaseForm submit handler
addLeaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!verifiedTenant) return;

  const propertyId = $("#propertySelect").value;
  if (!propertyId) {
    alert("Please select an available property.");
    return;
  }

  const btn = addLeaseForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Sending Offer...";

  // Create a lease offer document instead of updating the tenant
  const leaseOfferData = {
    landlordId: currentUser.uid,
    landlordName: landlordProfile.fullName || "Your Landlord", // Add landlord name
    tenantId: verifiedTenant.id, // This is the tenant's UID
    propertyId: propertyId,
    leaseDate: new Date($("#leaseDate").value),
    leaseExpiryDate: new Date($("#leaseExpiryDate").value),
    rentAmount: Number($("#rentAmount").value),
    advancePayment: Number($("#advancePayment").value) || 0,
    rentPayDate: Number($("#rentPayDate").value),
    status: "pending", // NEW: Status for tenant confirmation
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    // Create a new document in 'lease_offers'
    await db.collection("lease_offers").add(leaseOfferData);

    alert("Lease offer sent to tenant for confirmation."); // Change message
    addTenantModal.close();
    // No need to reload data, just reset the form
    resetAddTenantForm();
  } catch (error) {
    console.error("Error sending lease offer:", error);
    alert("Failed to send lease offer.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Lease";
  }
});

function resetAddTenantForm() {
  verifyTenantForm.reset();
  addLeaseForm.reset();
  addLeaseSection.classList.add("hidden");
  verifyTenantForm.classList.remove("hidden");
  verifiedTenant = null;
  // Re-enable submit button in case it was disabled
  const btn = addLeaseForm.querySelector('button[type="submit"]');
  if (btn) btn.disabled = false;
}

/* ---------------- Technicians Logic ---------------- */

async function loadTechnicians() {
  technicians = [];
  const snap = await db
    .collection("technicians")
    .where("landlordId", "==", currentUser.uid)
    .get();
  snap.forEach((doc) => {
    technicians.push({ id: doc.id, ...doc.data() });
  });
  renderTechnicians();
}

function renderTechnicians() {
  const list = $("#techniciansList");
  list.innerHTML = "";

  if (!technicians.length) {
    list.innerHTML = `<div class="list-item">You have not added any technicians yet.</div>`;
    return;
  }

  technicians.forEach((tech) => {
    const div = document.createElement("div");
    div.className = "list-item technician-item";
    div.innerHTML = `
      <div class="technician-info">
        <strong>${tech.name}</strong>
        <span class="technician-role">${tech.role}</span>
      </div>
      <div class="technician-contact">
        <span>${tech.phone}</span>
        <span>${tech.email || "No email"}</span>
      </div>
      <div class="technician-actions">
        <button class="btn ghost" data-action="edit-tech" data-technician-id="${
          tech.id
        }">Edit</button>
        <button class="btn ghost danger" data-action="remove-tech" data-technician-id="${
          tech.id
        }">Remove</button>
      </div>
    `;
    list.appendChild(div);
  });
}

$("#addTechnicianBtn").addEventListener("click", () => {
  addTechnicianForm.reset();
  technicianIdInput.value = "";
  technicianModalTitle.textContent = "Add Technician";
  addTechnicianModal.showModal();
});

$("#cancelAddTechnicianBtn").addEventListener("click", () => {
  addTechnicianModal.close();
});

addTechnicianModal.addEventListener("close", () => {
  addTechnicianForm.reset();
  technicianIdInput.value = "";
});

addTechnicianForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const technicianId = technicianIdInput.value;

  const data = {
    landlordId: currentUser.uid,
    name: $("#technicianName").value,
    role: $("#technicianRole").value,
    phone: $("#technicianPhone").value,
    email: $("#technicianEmail").value || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (technicianId) {
      await db.collection("technicians").doc(technicianId).update(data);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("technicians").add(data);
    }
    addTechnicianModal.close();
    await loadTechnicians();
  } catch (error) {
    console.error("Error saving technician: ", error);
    alert("Failed to save technician.");
  }
});

$("#techniciansList").addEventListener("click", (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.technicianId;

  if (action === "edit-tech") {
    const tech = technicians.find((t) => t.id === id);
    if (tech) {
      technicianModalTitle.textContent = "Edit Technician";
      technicianIdInput.value = tech.id;
      $("#technicianName").value = tech.name;
      $("#technicianRole").value = tech.role;
      $("#technicianPhone").value = tech.phone;
      $("#technicianEmail").value = tech.email;
      addTechnicianModal.showModal();
    }
  }

  if (action === "remove-tech") {
    const tech = technicians.find((t) => t.id === id);
    // NEW: Open confirmation dialog for removing technician
    if (tech) confirmRemoveTechnician(tech);
  }
});

// MODIFIED: Added confirmation prompt
async function deleteTechnician(id) {
  try {
    await db.collection("technicians").doc(id).delete();
    await loadTechnicians();
  } catch (error) {
    console.error("Error removing technician: ", error);
    alert("Failed to remove technician.");
  }
}

/* ---------------- NEW: Confirmation Modal Logic ---------------- */
function setupConfirmModalListeners() {
  confirmCancelBtn.addEventListener("click", () => {
    confirmDialog.close();
    itemToRemove = null;
  });

  confirmOkBtn.addEventListener("click", () => {
    if (itemToRemove) {
      if (itemToRemove.type === "property") {
        deleteProperty(itemToRemove.id);
      } else if (itemToRemove.type === "tenant") {
        deleteTenant(itemToRemove.id, itemToRemove.propertyId);
      } else if (itemToRemove.type === "technician") {
        deleteTechnician(itemToRemove.id);
      }
    }
    confirmDialog.close();
    itemToRemove = null;
  });

  confirmDialog.addEventListener("close", () => {
    itemToRemove = null; // Clear item on close regardless of button clicked
  });
}

function confirmRemoveProperty(property) {
  itemToRemove = { type: "property", id: property.id };
  confirmTitle.textContent = "Remove Property?";
  confirmMessage.textContent = `Are you sure you want to remove the property "${
    property.propertyName || property.address
  }"? This action cannot be undone. Make sure no tenants are assigned.`;
  confirmOkBtn.classList.add("danger"); // Make confirm button red
  confirmDialog.showModal();
}

function confirmRemoveTenant(tenant, propertyId) {
  itemToRemove = { type: "tenant", id: tenant.id, propertyId: propertyId };
  confirmTitle.textContent = "Remove Tenant?";
  confirmMessage.textContent = `Are you sure you want to remove the tenant "${
    tenant.fullName || tenant.email
  }"? This will remove their lease association but not delete their account. This action cannot be undone.`;
  confirmOkBtn.classList.add("danger");
  confirmDialog.showModal();
}

function confirmRemoveTechnician(technician) {
  itemToRemove = { type: "technician", id: technician.id };
  confirmTitle.textContent = "Remove Technician?";
  confirmMessage.textContent = `Are you sure you want to remove the technician "${technician.name}"? This action cannot be undone.`;
  confirmOkBtn.classList.add("danger");
  confirmDialog.showModal();
}

/* ---------------- Logout ---------------- */
$("#logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "auth.html";
});
