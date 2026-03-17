const nameInput = document.getElementById("name");
const passwordInput = document.getElementById("password");

const groupName = document.getElementById("groupName");
const members = document.getElementById("members");
const groupsSelect = document.getElementById("groups");

const amount = document.getElementById("amount");
const balancesDiv = document.getElementById("balances");

const API = "https://spliit-backend.onrender.com";

let token = "";
let currentGroup = null;
let currentUser = "";

// ================= AUTH =================

async function register() {
  await fetch(API + "/register", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      name: nameInput.value,
      password: passwordInput.value
    })
  });
  alert("Registered");
}

async function login() {
  const res = await fetch(API + "/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      name: nameInput.value,
      password: passwordInput.value
    })
  });

  const data = await res.json();

  if (data.error) return alert(data.error);

  token = data.token;
  currentUser = data.user.name;

  document.getElementById("currentUser").innerText = currentUser;

  alert("Login success ✅");
  loadGroups();
}

// ================= GROUPS =================

async function loadGroups() {
  const res = await fetch(API + "/groups", {
    headers: { Authorization: token }
  });

  const groups = await res.json();
  groupsSelect.innerHTML = "";

  groups.forEach(g => {
    groupsSelect.innerHTML += `<option value="${g.id}">${g.name}</option>`;
  });
}

async function createGroup() {
  if (!groupName.value || !members.value) {
    return alert("Enter group name and members");
  }

  await fetch(API + "/create-group", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      Authorization: token
    },
    body: JSON.stringify({
      name: groupName.value,
      members: members.value.split(",").map(m => m.trim())
    })
  });

  groupName.value = "";
  members.value = "";

  loadGroups();
}

// ================= LOAD GROUP =================

async function loadGroup() {
  const res = await fetch(API + "/group/" + groupsSelect.value, {
    headers: { Authorization: token }
  });

  const data = await res.json();

  if (data.error) return alert(data.error);

  currentGroup = data;

  populateUsers();
  calculate();
}

// ================= POPULATE USERS =================

function populateUsers() {
  const splitDiv = document.getElementById("splitUsers");
  splitDiv.innerHTML = "";

  currentGroup.group.members.forEach(name => {
    splitDiv.innerHTML += `
      <label>
        <input type="checkbox" value="${name}" checked>
        ${name}
      </label>
    `;
  });
}

// ================= ADD EXPENSE =================

async function addExpense() {
  if (!currentGroup) return alert("Load group first");
  if (!amount.value) return alert("Enter amount");

  const checked = document.querySelectorAll("#splitUsers input:checked");
  const splitNames = Array.from(checked).map(c => c.value);

  if (splitNames.length === 0) {
    return alert("Select at least one person");
  }

  const splitArr = splitNames.map(n => {
    const cleanName = n.trim().toLowerCase();

    const user = currentGroup.users.find(
      u => u.name.trim().toLowerCase() === cleanName
    );

    if (!user) {
      console.log("Available users:", currentGroup.users);
      alert("❌ User not found: " + n);
      throw new Error("User mapping failed");
    }

    return {
      userId: user.id,
      share: Number(amount.value) / splitNames.length
    };
  });

  const payer = currentGroup.users.find(
    u => u.name.trim().toLowerCase() === currentUser.trim().toLowerCase()
  );

  if (!payer) {
    return alert("❌ Logged-in user not found in group");
  }

  await fetch(API + "/add-expense", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      Authorization: token
    },
    body: JSON.stringify({
      groupId: currentGroup.group.id,
      amount: Number(amount.value),
      paidBy: payer.id,
      split: splitArr
    })
  });

  amount.value = "";

  loadGroup();
}

// ================= CALCULATE =================

function calculate() {
  const balances = {};
  currentGroup.group.members.forEach(m => balances[m] = 0);

  currentGroup.expenses.forEach(exp => {
    exp.split.forEach(s => {
      if (s.userId !== exp.paidBy) {
        const payer = currentGroup.users.find(u => u.id === exp.paidBy).name;
        const user = currentGroup.users.find(u => u.id === s.userId).name;

        balances[user] -= s.share;
        balances[payer] += s.share;
      }
    });
  });

  balancesDiv.innerHTML = "";

  for (let person in balances) {
    const val = balances[person];
    const color = val > 0 ? "green" : val < 0 ? "red" : "black";

    balancesDiv.innerHTML += `
      <p style="color:${color}">
        ${person}: ₹${val.toFixed(2)}
      </p>
    `;
  }

  showOwes(balances);
  showExpenses();
}

// ================= WHO OWES =================

function showOwes(balances) {
  const tbody = document.querySelector("#owesTable tbody");
  tbody.innerHTML = "";

  const debtors = [];
  const creditors = [];

  for (let p in balances) {
    if (balances[p] < 0) debtors.push({ name: p, amount: -balances[p] });
    else if (balances[p] > 0) creditors.push({ name: p, amount: balances[p] });
  }

  debtors.forEach(d => {
    creditors.forEach(c => {
      if (d.amount > 0 && c.amount > 0) {
        const pay = Math.min(d.amount, c.amount);

        tbody.innerHTML += `
          <tr>
            <td>
              <input type="checkbox" class="settleCheck"
                data-from="${d.name}"
                data-to="${c.name}"
                data-amount="${pay}">
            </td>
            <td>${d.name}</td>
            <td>➡️</td>
            <td>${c.name}</td>
            <td>₹${pay.toFixed(2)}</td>
          </tr>
        `;

        d.amount -= pay;
        c.amount -= pay;
      }
    });
  });
}

// ================= SETTLE SELECTED =================

async function settleSelected() {
  const checks = document.querySelectorAll(".settleCheck:checked");

  if (checks.length === 0) {
    return alert("Select at least one settlement");
  }

  for (let chk of checks) {
    const from = chk.dataset.from;
    const to = chk.dataset.to;
    const amt = Number(chk.dataset.amount);

    const payer = currentGroup.users.find(
      u => u.name.trim().toLowerCase() === from.trim().toLowerCase()
    );

    const receiver = currentGroup.users.find(
      u => u.name.trim().toLowerCase() === to.trim().toLowerCase()
    );

    if (!payer || !receiver) {
      alert("User mapping failed in settlement");
      continue;
    }

    await fetch(API + "/add-expense", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        Authorization: token
      },
      body: JSON.stringify({
        groupId: currentGroup.group.id,
        amount: amt,
        paidBy: payer.id,
        split: [
          { userId: receiver.id, share: amt }
        ]
      })
    });
  }

  alert("Settled selected ✅");
  loadGroup();
}

// ================= EXPENSE LIST =================

function showExpenses() {
  const div = document.getElementById("expensesList");
  div.innerHTML = "";

  currentGroup.expenses.forEach(exp => {
    const payer = currentGroup.users.find(u => u.id === exp.paidBy).name;

    const names = exp.split.map(s =>
      currentGroup.users.find(u => u.id === s.userId).name
    );

    div.innerHTML += `
      <p>
        <b>${payer}</b> paid ₹${exp.amount} for ${names.join(", ")}
      </p>
    `;
  });
}