import { dataService } from "../services/index.js";
import { toast } from "../utils.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function renderAuth(root, { onAuthed }) {
  let mode = "login"; // login | register | reset

  function draw() {
    root.innerHTML = `
      <div class="auth-card fade-in">
        <h1>${mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Reset your password"}</h1>
        <p class="auth-sub">${mode === "login" ? "Log in to your private ledger." : mode === "register" ? "Your data stays on your own server." : "We'll send a reset link to your email."}</p>
        <form id="auth-form" novalidate>
          <div class="field">
            <label for="f-email">Email</label>
            <input id="f-email" type="email" autocomplete="email" required>
            <div class="field-error" id="err-email"></div>
          </div>
          ${mode !== "reset" ? `
          <div class="field">
            <label for="f-password">Password</label>
            <div class="password-wrap">
              <input id="f-password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required>
              <button type="button" class="password-toggle" id="toggle-pw">Show</button>
            </div>
            <div class="field-error" id="err-password"></div>
          </div>` : ""}
          ${mode === "register" ? `
          <div class="field">
            <label for="f-confirm">Confirm password</label>
            <input id="f-confirm" type="password" autocomplete="new-password" required>
            <div class="field-error" id="err-confirm"></div>
          </div>` : ""}
          ${mode === "login" ? `<p class="auth-note">You'll stay signed in on this device until you log out.</p>` : ""}
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">
            ${mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
          </button>
        </form>
        <div class="auth-switch">
          ${mode === "login" ? `<button id="to-reset">Forgot password?</button> · <button id="to-register">Create an account</button>`
            : mode === "register" ? `Already have an account? <button id="to-login">Log in</button>`
            : `<button id="to-login">Back to log in</button>`}
        </div>
      </div>
    `;

    root.querySelector("#to-register")?.addEventListener("click", () => { mode = "register"; draw(); });
    root.querySelector("#to-login")?.addEventListener("click", () => { mode = "login"; draw(); });
    root.querySelector("#to-reset")?.addEventListener("click", () => { mode = "reset"; draw(); });

    const pwToggle = root.querySelector("#toggle-pw");
    pwToggle?.addEventListener("click", () => {
      const input = root.querySelector("#f-password");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      pwToggle.textContent = show ? "Hide" : "Show";
    });

    root.querySelector("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();
      const email = root.querySelector("#f-email").value.trim();
      let valid = true;
      if (!EMAIL_RE.test(email)) { setError("email", "Enter a valid email address."); valid = false; }

      if (mode === "reset") {
        if (!valid) return;
        setLoading(true);
        try {
          await dataService.requestPasswordReset(email);
          toast("Reset link sent — check your inbox.", "success");
          mode = "login"; draw();
        } catch (err) { toast(err.message, "error"); }
        finally { setLoading(false); }
        return;
      }

      const password = root.querySelector("#f-password").value;
      if (password.length < 8) { setError("password", "Password must be at least 8 characters."); valid = false; }

      if (mode === "register") {
        const confirm = root.querySelector("#f-confirm").value;
        if (confirm !== password) { setError("confirm", "Passwords don't match."); valid = false; }
      }
      if (!valid) return;

      setLoading(true);
      try {
        const user = mode === "login" ? await dataService.login(email, password) : await dataService.register(email, password);
        toast(mode === "login" ? "Welcome back!" : "Account created.", "success");
        onAuthed(user);
      } catch (err) {
        if (/exist/i.test(err.message)) setError("email", err.message);
        else if (/invalid/i.test(err.message)) setError("password", err.message);
        else toast(err.message, "error");
      } finally { setLoading(false); }
    });
  }

  function setError(field, msg) {
    const el = root.querySelector(`#err-${field}`);
    if (el) el.textContent = msg;
    root.querySelector(`#f-${field}`)?.classList.add("input-invalid");
  }
  function clearErrors() {
    root.querySelectorAll(".field-error").forEach((e) => (e.textContent = ""));
    root.querySelectorAll("input").forEach((i) => i.classList.remove("input-invalid"));
  }
  function setLoading(state) {
    const btn = root.querySelector("#auth-submit");
    btn.disabled = state;
    btn.textContent = state ? "Please wait…" : (mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link");
  }

  draw();
}
