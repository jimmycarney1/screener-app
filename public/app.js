(function () {
  const form = document.getElementById("rsvp-form");
  const comingDetails = document.getElementById("coming-details");
  const comingRadios = form.querySelectorAll('input[name="coming"]');
  const msg = document.getElementById("form-msg");
  const btn = document.getElementById("submit-btn");

  // Show/hide the "details" block based on whether they're coming.
  function syncDetails() {
    const coming = form.querySelector('input[name="coming"]:checked');
    const isComing = coming && coming.value === "yes";
    comingDetails.hidden = !isComing;
  }
  comingRadios.forEach((r) => r.addEventListener("change", syncDetails));

  function setMsg(text, type) {
    msg.textContent = text;
    msg.className = "form-msg" + (type ? " " + type : "");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("", "");

    const name = form.name.value.trim();
    const comingEl = form.querySelector('input[name="coming"]:checked');
    if (!name) {
      setMsg("Please add your name 🙂", "error");
      form.name.focus();
      return;
    }
    if (!comingEl) {
      setMsg("Let us know if you can make it!", "error");
      return;
    }

    const coming = comingEl.value;
    const competingEl = form.querySelector('input[name="competing"]:checked');
    const days = Array.from(
      form.querySelectorAll('input[name="days"]:checked')
    ).map((c) => c.value);

    const payload = {
      name,
      coming,
      competing: coming === "yes" && competingEl ? competingEl.value : null,
      days: coming === "yes" ? days : [],
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
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Request failed");
      }
      form.reset();
      syncDetails();
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
