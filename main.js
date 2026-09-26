// --- CONFIGURATION ---
// PASTE YOUR POWER AUTOMATE WEBHOOK URL HERE
const WEBHOOK_URL =
  "https://default39e141900b234ecd99f9606ad12158.81.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/19/workflows/5f672e45aff34f59a1761d36878a20d5/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=INLnfdl7DCYgiO7fpFzLhK4HH03DHxhoJTVafs_mvtY";

// Global variable to hold the state from the URL
let regionalState = "Unknown";

// --- INITIALIZATION ---
// We wrap this in DOMContentLoaded to ensure the HTML exists before attaching
document.addEventListener("DOMContentLoaded", function () {
  // 1. URL ROUTING: Read the URL (e.g., ?state=FL)
  const urlParams = new URLSearchParams(window.location.search);
  const stateParam = urlParams.get("state");
  const titleEl = document.getElementById("appTitle");

  // If a state is in the URL, update the browser tab title and the variable
  if (stateParam) {
    regionalState = stateParam.toUpperCase();
    document.title = `${regionalState} MDU Event Logger`;
    if (titleEl) titleEl.innerText = `${regionalState} MDU Event Logger`;
  } else {
    // Fallback just in case a rep uses a naked link without the ?state= part
    document.title = "MDU Event Logger (No State Assigned)";
    if (titleEl) titleEl.innerText = "MDU Event Logger (No State Assigned)";
  }

  // 2. INITIALIZE FLATPICKR
  flatpickr("#followUpTime", {
    enableTime: true, // Adds the time picker at the bottom
    dateFormat: "Y-m-d\\TH:i:S\\Z", // Formats the date to match SharePoint/ISO standard
    altInput: true, // Creates a second, human-readable input for display
    altFormat: "F j, Y at h:i K", // E.g., "August 18, 2026 at 02:30 PM"
    minDate: "today", // Prevents reps from scheduling follow-ups in the past
    disableMobile: "true", // CRITICAL: Forces the beautiful UI on tablets instead of native
  });
});

// --- TRANSITION LOGIC ---
function nextStep(current, next) {
  const currentStepEl = document.getElementById(`step${current}`);

  // Only validate inputs within the current visible step
  const inputs = Array.from(
    currentStepEl.querySelectorAll("input, textarea, select"),
  );
  for (let input of inputs) {
    if (!input.checkValidity()) {
      input.reportValidity(); // Triggers the native tooltip on the invalid field
      return; // Stops the transition
    }
  }

  const nextEl = document.getElementById(`step${next}`);

  currentStepEl.style.opacity = 0;

  setTimeout(() => {
    currentStepEl.classList.remove("active");
    nextEl.classList.add("active");

    setTimeout(() => {
      nextEl.style.opacity = 1;
    }, 50);
  }, 500);
}

// --- CONDITIONAL UI LOGIC ---
function handleFlowLogic() {
  const isClosed = document.querySelector(
    'input[name="ClosedSale"]:checked',
  )?.value;
  const isCreditChallenged = document.querySelector(
    'input[name="CreditChallenged"]:checked',
  )?.value;
  const needsFollowUp = document.querySelector(
    'input[name="FollowUpNeeded"]:checked',
  )?.value;

  document.getElementById("creditChallengeGroup").classList.remove("hidden");
  document.getElementById("creditNotesGroup").classList.add("hidden");
  document.getElementById("followUpGroup").classList.add("hidden");
  document.getElementById("followUpTimeGroup").classList.add("hidden");

  if (isClosed === "Yes" || isClosed === "No") {
    if (isCreditChallenged === "Yes") {
      document.getElementById("creditNotesGroup").classList.remove("hidden");
    }

    if (isClosed === "No") {
      document.getElementById("followUpGroup").classList.remove("hidden");
      if (needsFollowUp === "Yes") {
        document.getElementById("followUpTimeGroup").classList.remove("hidden");
      }
    }
  }
}

function validateStep2() {
  const isCreditChallenged = document.querySelector(
    'input[name="CreditChallenged"]:checked',
  )?.value;
  const creditNotes = document.getElementById("creditNotes").value.trim();

  // Custom validation for the conditional credit notes
  if (isCreditChallenged === "Yes" && creditNotes === "") {
    document.getElementById("creditError").style.display = "block";
    return;
  } else {
    document.getElementById("creditError").style.display = "none";
  }

  // If our custom logic passes, hand it off to the standard step transition
  nextStep(2, 3);
}

// --- FORM SUBMISSION ---
async function submitForm() {
  const step3El = document.getElementById("step3");

  // Only validate Step 3's inputs before submitting
  const inputs = Array.from(
    step3El.querySelectorAll("input, textarea, select"),
  );
  for (let input of inputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
  }

  document.getElementById("step3").style.display = "none";
  document.getElementById("loader").style.display = "block";

  let combinedNotes = "";
  const genNotes = document.getElementById("generalNotes").value.trim();
  const credNotes = document.getElementById("creditNotes").value.trim();

  if (genNotes) combinedNotes += `[SALE NOTES]\n${genNotes}\n\n`;
  if (credNotes) combinedNotes += `[CREDIT CHALLENGE NOTES]\n${credNotes}`;

  const payload = {
    Title: document.getElementById("email").value,
    Name: document.getElementById("name").value,
    FullAddress: document.getElementById("address").value,
    CBR: document.getElementById("cbr").value,
    InternetProspect: document.getElementById("intInternet").checked
      ? "Yes"
      : "No",
    MobileProspect: document.getElementById("intMobile").checked ? "Yes" : "No",
    CreditChallenged:
      document.querySelector('input[name="CreditChallenged"]:checked')?.value ||
      "No",
    Notes: combinedNotes,
    ClosedSale:
      document.querySelector('input[name="ClosedSale"]:checked')?.value || "No",
    FollowUpNeeded:
      document.querySelector('input[name="FollowUpNeeded"]:checked')?.value ||
      "No",
    FollowUpTime: document.getElementById("followUpTime").value || null,
    SalesRepName: document.getElementById("repName").value,
    MDUPropertyName: document.getElementById("mduName").value,
    SubmissionDate: new Date().toISOString(),
    LocationName: regionalState, // Added the dynamically pulled State here!
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      document.getElementById("loader").innerHTML =
        "<h2 style='border:none; color:green;'>✅ Success!</h2><p style='font-size:1.4rem'>Data synced. Reloading form...</p>";
      setTimeout(() => location.reload(), 2000);
    } else {
      throw new Error("Network response was not ok.");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    document.getElementById("loader").innerHTML =
      "<h2 style='border:none; color:var(--primary);'>❌ Error</h2><p style='font-size:1.4rem'>Could not submit data. Please try again.</p>";
    setTimeout(() => {
      document.getElementById("loader").style.display = "none";
      document.getElementById("step3").style.display = "block";
    }, 3000);
  }
}
