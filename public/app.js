// Expandable event cards
(function () {
  document.querySelectorAll(".event-head").forEach((head) => {
    head.addEventListener("click", () => {
      const body = head.nextElementSibling;
      const open = head.getAttribute("aria-expanded") === "true";
      head.setAttribute("aria-expanded", String(!open));
      body.hidden = open;
    });
  });
})();

(function () {
  const form = document.getElementById("rsvp-form");
  const comingDetails = document.getElementById("coming-details");
  const comingRadios = form.querySelectorAll('input[name="coming"]');
  const msg = document.getElementById("form-msg");
  const btn = document.getElementById("submit-btn");

  // Show who they're signed in as (from the display cookie set at sign-in).
  const nameMatch = document.cookie.match(/(?:^|;\s*)jimphi_guest_name=([^;]+)/);
  if (nameMatch) {
    try {
      document.getElementById("guest-name").textContent =
        decodeURIComponent(nameMatch[1]);
    } catch (_) {}
  }

  function syncDetails() {
    const coming = form.querySelector('input[name="coming"]:checked');
    comingDetails.hidden = !(coming && coming.value === "yes");
  }
  comingRadios.forEach((r) => r.addEventListener("change", syncDetails));

  function setMsg(text, type) {
    msg.textContent = text;
    msg.className = "form-msg" + (type ? " " + type : "");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("", "");

    const comingEl = form.querySelector('input[name="coming"]:checked');
    if (!comingEl) {
      setMsg("Let us know if you can make it!", "error");
      return;
    }
    const coming = comingEl.value;
    const competingEl = form.querySelector('input[name="competing"]:checked');
    const arriveEl = form.querySelector('input[name="arrive"]:checked');
    const departEl = form.querySelector('input[name="depart"]:checked');

    const payload = {
      coming,
      competing: coming === "yes" && competingEl ? competingEl.value : null,
      arrive: coming === "yes" && arriveEl ? arriveEl.value : null,
      depart: coming === "yes" && departEl ? departEl.value : null,
      note: form.note.value.trim(),
    };

    btn.disabled = true;
    setMsg("Sending…", "");

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
      setMsg(
        coming === "yes"
          ? "🔥 You're on the roster! See you in Myrtle Beach 🏅"
          : "Thanks for letting us know — we'll miss you! 💛",
        "success"
      );
    } catch (err) {
      setMsg("Hmm, that didn't go through. Please try again.", "error");
    } finally {
      btn.disabled = false;
    }
  });
})();
