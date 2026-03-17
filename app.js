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
  console.log(data);

  if (data.error) return alert(data.error);

  token = data.token;
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

  loadGroups();
}

// ================= LOAD GROUP =================

async function loadGroup() {
  const res = await fetch(API + "/group/" + groupsSelect.value, {
    headers: { Authorization: token }
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  currentGroup = data;

  populateUsers();
  calculate();
}

// ================= POPULATE USERS =================

function populateUsers() {
  const paidBySelect = document.getElementById("paidBy");
  const splitDiv = document.getElementById("splitUsers");

  paidBySelect.innerHTML = "";
  splitDiv.innerHTML = "";

  currentGroup.group.members.forEach(name => {
    paidBySelect.innerHTML += `<option value="${name}">${name}</option>`;

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

  console.log("ADD CLICKED");   // 👈 ADD THIS LINE HERE

  if (!currentGroup) {
    alert("Load group first");
    return;
  }

  if (!amount.value) {
    alert("Enter amount");
    return;
  }

  const checked = document.querySelectorAll("#splitUsers input:checked");
  const splitNames = Array.from(checked).map(c => c.value);

  console.log("Split names:", splitNames);  // 👈 ADD THIS ALSO

  const splitArr = splitNames.map(n => {
    const user = currentGroup.users.find(u => u.name === n);

    if (!user) {
      alert("User not found: " + n);
      throw new Error("User missing");
    }

    return {
      userId: user.id,
      share: Number(amount.value) / splitNames.length
    };
  });

  const payerName = document.getElementById("paidBy").value;
  const payer = currentGroup.users.find(u => u.name === payerName);

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

  loadGroup();
}
// ================= DELETE =================

async function deleteExpense(id) {
  await fetch(API + "/expense/" + id, {
    method: "DELETE",
    headers: { Authorization: token }
  });

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

  balancesDiv.innerHTML = `<pre>${JSON.stringify(balances, null, 2)}</pre>`;

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
        <button onclick="deleteExpense(${exp.id})">❌</button>
      </p>
    `;
  });
}