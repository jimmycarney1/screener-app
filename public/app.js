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
      plusOnes: Array.from(form.querySelectorAll(".plus-name")).map((i) => i.value.trim()).filter(Boolean),
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
      if (res.status === 401) { showCheckin(); throw new Error("Please check in again to save your RSVP."); }
      if (!res.ok || !data.ok) {
        if (data.unknown) {
          markUnknown(data.unknown);
          throw new Error("We couldn't find " + data.unknown.join(", ") + " on the guest list — check the spelling.");
        }
        throw new Error("Hmm, that didn't go through. Please try again.");
      }
      setMsg("", "");
      payload.plusSaved = data.plusOnes || [];
      payload.plusSkipped = data.skipped || [];
      showDone(payload, true);
    } catch (err) {
      setMsg(err.message || "Hmm, that didn't go through. Please try again.", "error");
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
        row("Note", r.note) +
        row("Also RSVP'd for", (r.plusSaved || []).join(", "))
      : row("Note", r.note) + row("Also RSVP'd for", (r.plusSaved || []).join(", "));
    const skippedNote = (r.plusSkipped || []).length
      ? '<p class="done-skip">' + esc(r.plusSkipped.join(", ")) + " already RSVP'd, so we left theirs as is.</p>"
      : "";
    done.innerHTML =
      '<p class="done-emoji">' + (yes ? "🎉" : "💛") + "</p>" +
      '<h3 class="done-title">' + (yes ? "You're on the roster!" : "Thanks for letting us know") + "</h3>" +
      '<p class="done-sub">' + (yes ? "See you in Myrtle Beach 🏖️" : "We'll miss you — if plans change, just update below.") + "</p>" +
      (items ? '<ul class="done-list">' + items + "</ul>" : "") + skippedNote +
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

  const plusList = document.getElementById("plus-list");
  const plusAdd = document.getElementById("plus-add");
  function addPlusInput(value) {
    const blank = Array.from(plusList.querySelectorAll(".plus-name")).find((i) => !i.value.trim());
    if (blank && !value) { blank.focus(); return blank; }
    const inp = blank && value ? blank : document.createElement("input");
    if (inp !== blank) {
      inp.type = "text"; inp.className = "plus-name"; inp.placeholder = "Their name"; inp.autocomplete = "off";
      plusList.appendChild(inp);
    }
    if (value) inp.value = value;
    return inp;
  }
  function markUnknown(names) {
    const bad = names.map((n) => n.toLowerCase());
    plusList.querySelectorAll(".plus-name").forEach((i) => i.classList.toggle("bad", bad.includes(i.value.trim().toLowerCase())));
  }
  if (plusList && plusAdd) {
    plusAdd.addEventListener("click", () => { if (plusList.children.length < 6) addPlusInput("").focus(); });
    plusList.addEventListener("input", (e) => e.target.classList.remove("bad"));
  }

  function check(name, value) {
    if (!value) return;
    const el = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  // ---- Check-in (password + name) gates the RSVP form; the rest of the site is public ----
  const checkin = document.getElementById("checkin-form");
  const rsvpAs = document.getElementById("rsvp-as");
  const guestNameEl = document.getElementById("guest-name");

  function showCheckin() {
    if (!checkin) { form.hidden = false; return; }
    checkin.hidden = false;
    form.hidden = true;
    done.hidden = true;
    if (rsvpAs) rsvpAs.hidden = true;
  }

  function resetForm() {
    form.reset();
    if (plusList) plusList.querySelectorAll(".plus-name").forEach((i, n) => { if (n) i.remove(); else i.value = ""; });
    syncDetails();
    setMsg("", "");
  }

  // Load the signed-in guest's saved RSVP; if nobody is signed in, show the check-in.
  function loadMine() {
    return fetch("/api/rsvp", { headers: { accept: "application/json" }, cache: "no-store" })
      .then((res) => (res.status === 401 ? { signedOut: true } : res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.signedOut || !data.ok) { if (!data || data.signedOut) showCheckin(); return; }
        if (checkin) checkin.hidden = true;
        const g = data.guest || {};
        if (guestNameEl && g.name) guestNameEl.textContent = g.name;
        if (rsvpAs) rsvpAs.hidden = false;
        if (g.email && !form.email.value) form.email.value = g.email;
        if (g.phone && !form.phone.value) form.phone.value = g.phone;
        const r = data.rsvp;
        if (!r) { form.hidden = false; done.hidden = true; return; }
        check("coming", r.coming);
        check("competing", r.competing);
        check("arrive", r.arrive);
        check("depart", r.depart);
        if (r.note) form.note.value = r.note;
        if (r.game_ideas && form.gameideas) form.gameideas.value = r.game_ideas;
        if (plusList) (data.plusOnes || []).forEach((n) => addPlusInput(n));
        r.plusSaved = data.plusOnes || [];
        syncDetails();
        showDone(r, false);
      })
      .catch(() => {});
  }

  if (checkin) {
    const cmsg = document.getElementById("checkin-msg");
    const cbtn = document.getElementById("checkin-btn");
    checkin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("checkin-password").value;
      const name = document.getElementById("checkin-name").value.trim();
      if (!password || !name) { cmsg.textContent = "Enter the password and your name."; cmsg.className = "form-msg error"; return; }
      cbtn.disabled = true;
      cmsg.textContent = "Checking…"; cmsg.className = "form-msg";
      try {
        const res = await fetch("/api/signin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password, name }),
        });
        if (res.status === 401) throw new Error("Wrong password — check your invite.");
        if (res.status === 404) throw new Error("We couldn't find that name on the guest list — check the spelling or ask Jimmy & Phi.");
        if (!res.ok) throw new Error("Something went wrong. Try again.");
        cmsg.textContent = ""; cmsg.className = "form-msg";
        document.getElementById("checkin-password").value = "";
        resetForm();
        await loadMine();
        (form.hidden ? done : form).scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        cmsg.textContent = err.message; cmsg.className = "form-msg error";
      } finally {
        cbtn.disabled = false;
      }
    });
  }

  const switchBtn = document.getElementById("switch-guest");
  if (switchBtn) {
    switchBtn.addEventListener("click", async () => {
      await fetch("/api/signout", { method: "POST" }).catch(() => {});
      resetForm();
      showCheckin();
      document.getElementById("checkin-name").focus();
    });
  }

  loadMine();
})();
