(function () {
  /**
   * Public media inquiries.
   *
   * TODO(api): There is no lead endpoint. POST /api/v1/account-requests
   * accepts only { email, name, company, message? } and creates a PENDING
   * client-portal account request. Do not send RFPs there.
   *
   * When a public lead route exists, set LEAD_URL to its absolute URL.
   * The handler will POST this JSON body and use mailto only if that
   * request fails:
   * {
   *   name: string,
   *   email: string,
   *   company: string,
   *   markets: string,
   *   budget: string,   // "" when the visitor skipped it
   *   message: string
   * }
   * Treat any 2xx response as success. There is no idempotency key yet.
   */
  var LEAD_URL = null;
  var MAIL_TO = "info@dempsey.agency";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  var companyInput = document.getElementById("company");
  var marketsInput = document.getElementById("markets");
  var budgetInput = document.getElementById("budget");
  var messageInput = document.getElementById("message");
  var errorEl = document.getElementById("form-error");
  var successEl = document.getElementById("form-success");
  var submitBtn = form.querySelector("[type='submit']");

  function payload() {
    return {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      company: companyInput.value.trim(),
      markets: marketsInput.value.trim(),
      budget: budgetInput.value.trim(),
      message: messageInput.value.trim(),
    };
  }

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = false;
    successEl.hidden = true;
  }

  function validate(data) {
    errorEl.hidden = true;
    if (!data.name) {
      nameInput.focus();
      showError("Enter your name.");
      return false;
    }
    if (!data.email || data.email.indexOf("@") === -1) {
      emailInput.focus();
      showError("Enter a valid email address.");
      return false;
    }
    if (!data.company) {
      companyInput.focus();
      showError("Enter your company.");
      return false;
    }
    if (!data.markets) {
      marketsInput.focus();
      showError("Enter the markets or geography you want to reach.");
      return false;
    }
    if (!data.message) {
      messageInput.focus();
      showError("Describe the goal of the inquiry.");
      return false;
    }
    return true;
  }

  function mailtoUrl(data) {
    var lines = [
      "Name: " + data.name,
      "Email: " + data.email,
      "Company: " + data.company,
      "Markets: " + data.markets,
      "Budget: " + (data.budget || "Not specified"),
      "",
      "Goal:",
      data.message,
    ];
    return (
      "mailto:" +
      MAIL_TO +
      "?subject=" +
      encodeURIComponent("Media inquiry — " + data.company) +
      "&body=" +
      encodeURIComponent(lines.join("\n"))
    );
  }

  function openMailto(data) {
    successEl.textContent =
      "Your email app will open with this inquiry addressed to " +
      MAIL_TO +
      ". Send the message and we will reply within one business day.";
    successEl.hidden = false;
    window.location.href = mailtoUrl(data);
  }

  function submitToApi(data) {
    submitBtn.disabled = true;
    var previous = submitBtn.textContent;
    submitBtn.textContent = "Sending…";
    fetch(LEAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(
          function (body) {
            return { ok: res.ok, status: res.status, body: body };
          },
          function () {
            return { ok: res.ok, status: res.status, body: {} };
          }
        );
      })
      .then(function (result) {
        if (result.ok) {
          successEl.textContent =
            "Your inquiry has been sent. We will reply within one business day.";
          successEl.hidden = false;
          form.reset();
          submitBtn.textContent = "Inquiry sent";
          return;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = previous;
        openMailto(data);
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = previous;
        openMailto(data);
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = payload();
    if (!validate(data)) return;
    if (LEAD_URL) {
      submitToApi(data);
      return;
    }
    openMailto(data);
  });
})();
