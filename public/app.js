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
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      note: form.note.value.trim(),
      gameIdeas: form.gameideas ? form.gameideas.value.trim() : "",
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
      setMsg("", "");
      showDone(payload, true);
    } catch (err) {
      setMsg("Hmm, that didn't go through. Please try again.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Success card: collapse the form once they've RSVP'd ----
  const LABEL = { wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const done = document.createElement("div");
  done.className = "rsvp-done";
  done.hidden = true;
  done.setAttribute("tabindex", "-1");
  form.parentNode.insertBefore(done, form);

  function esc(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function row(label, value) {
    return value ? "<li><span>" + label + "</span><strong>" + esc(value) + "</strong></li>" : "";
  }

  function showDone(r, justSaved) {
    const yes = r.coming === "yes";
    const items = yes
      ? row("Competing", r.competing === "yes" ? "🏅 Yes, let's go!" : r.competing === "no" ? "🍹 Cheering from the sidelines" : "") +
        row("Arriving", LABEL[r.arrive]) +
        row("Leaving", LABEL[r.depart]) +
        row("Game ideas", r.gameIdeas || r.game_ideas) +
        row("Note", r.note)
      : row("Note", r.note);
    done.innerHTML =
      '<p class="done-emoji">' + (yes ? "🎉" : "💛") + "</p>" +
      '<h3 class="done-title">' + (yes ? "You're on the roster!" : "Thanks for letting us know") + "</h3>" +
      '<p class="done-sub">' + (yes ? "See you in Myrtle Beach 🏖️" : "We'll miss you — if plans change, just update below.") + "</p>" +
      (items ? '<ul class="done-list">' + items + "</ul>" : "") +
      '<button type="button" class="done-edit">✏️ Edit my RSVP</button>';
    done.querySelector(".done-edit").addEventListener("click", () => {
      done.hidden = true;
      form.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    form.hidden = true;
    done.hidden = false;
    if (justSaved) {
      done.classList.remove("pop");
      void done.offsetWidth;
      done.classList.add("pop");
      done.scrollIntoView({ behavior: "smooth", block: "center" });
      done.focus({ preventScroll: true });
    }
  }

  function check(name, value) {
    if (!value) return;
    const el = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  // On load: if they've already RSVP'd, prefill the form and show the summary.
  fetch("/api/rsvp", { headers: { accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.ok) return;
      const g = data.guest || {};
      if (g.email && !form.email.value) form.email.value = g.email;
      if (g.phone && !form.phone.value) form.phone.value = g.phone;
      const r = data.rsvp;
      if (!r) return;
      check("coming", r.coming);
      check("competing", r.competing);
      check("arrive", r.arrive);
      check("depart", r.depart);
      if (r.note) form.note.value = r.note;
      if (r.game_ideas && form.gameideas) form.gameideas.value = r.game_ideas;
      syncDetails();
      showDone(r, false);
    })
    .catch(() => {});
})();
