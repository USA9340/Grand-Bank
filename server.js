const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const fs = require("fs")
const app = express()
const PORT = process.env.PORT || 7860

// Middleware
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, "/")))

// Data files
const USERS_FILE = path.join(__dirname, "users.json")
const TRANSACTIONS_FILE = path.join(__dirname, "transactions.json")

// Initialize data
let users = []
let transactions = []

// Load data from files or create default if not exists
function loadData() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf8")
      users = JSON.parse(data)
    } else {
      // Create default admin user
      users = [
        {
          id: 1,
          name: "Admin",
          email: "admin@grand.com",
          password: "admin123",
          balance: 5000000000.0,
          isAdmin: true,
          accountNumber: "1234567890",
          status: "active",
          createdAt: new Date().toISOString(),
        },
      ]
      saveUsers()
    }

    if (fs.existsSync(TRANSACTIONS_FILE)) {
      const data = fs.readFileSync(TRANSACTIONS_FILE, "utf8")
      transactions = JSON.parse(data)
    } else {
      transactions = []
      saveTransactions()
    }
  } catch (error) {
    console.error("Error loading data:", error)
  }
}

// Save users to file
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  } catch (error) {
    console.error("Error saving users:", error)
  }
}

// Save transactions to file
function saveTransactions() {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2))
  } catch (error) {
    console.error("Error saving transactions:", error)
  }
}

// Load data on startup
loadData()

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"))
})

// Reload data from files before each API request
app.use("/api/*", (req, res, next) => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf8")
      users = JSON.parse(data)
    }

    if (fs.existsSync(TRANSACTIONS_FILE)) {
      const data = fs.readFileSync(TRANSACTIONS_FILE, "utf8")
      transactions = JSON.parse(data)
    }
    next()
  } catch (error) {
    console.error("Error reloading data:", error)
    next()
  }
})

// API Routes
// Get all users (admin only)
app.get("/api/users", (req, res) => {
  res.json(users)
})

// Get user by ID
app.get("/api/users/:id", (req, res) => {
  const user = users.find((u) => u.id === Number.parseInt(req.params.id))
  if (!user) return res.status(404).json({ message: "User not found" })

  // Don't send password
  const { password, ...userWithoutPassword } = user
  res.json(userWithoutPassword)
})

// Register new user
app.post("/api/users/register", (req, res) => {
  const { name, email, password } = req.body

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Please provide name, email and password" })
  }

  // Check if email already exists
  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ message: "Email already registered" })
  }

  // Generate random account number
  const accountNumber = Math.floor(Math.random() * 9000000000) + 1000000000

  // Create new user
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password, // In a real app, you would hash this password
    balance: 0,
    isAdmin: false,
    accountNumber: accountNumber.toString(),
    status: "active",
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)
  saveUsers() // Make sure to save to file

  // Don't send password back
  const { password: pwd, ...userWithoutPassword } = newUser
  res.status(201).json(userWithoutPassword)
})

// Login
app.post("/api/users/login", (req, res) => {
  const { email, password } = req.body

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password" })
  }

  // Find user
  const user = users.find((u) => u.email === email && u.password === password)

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" })
  }

  // Don't send password back
  const { password: pwd, ...userWithoutPassword } = user
  res.json(userWithoutPassword)
})

// Save users (for client-side storage)
app.post("/api/users/save", (req, res) => {
  users = req.body
  saveUsers() // Make sure to save to file
  res.json({ message: "Users saved successfully" })
})

// Get all transactions
app.get("/api/transactions", (req, res) => {
  res.json(transactions)
})

// Save transactions (for client-side storage)
app.post("/api/transactions/save", (req, res) => {
  transactions = req.body
  saveTransactions() // Make sure to save to file
  res.json({ message: "Transactions saved successfully" })
})

// Transfer funds
app.post("/api/transactions/transfer", (req, res) => {
  const { fromId, toIdentifier, amount, description } = req.body

  // Validate input
  if (!fromId || !toIdentifier || !amount) {
    return res.status(400).json({ message: "Please provide sender ID, recipient identifier and amount" })
  }

  // Find sender
  const sender = users.find((u) => u.id === Number.parseInt(fromId))

  if (!sender) {
    return res.status(404).json({ message: "Sender not found" })
  }

  // Find recipient (by email or account number)
  const recipient = users.find((u) => u.email === toIdentifier || u.accountNumber === toIdentifier)

  if (!recipient) {
    return res.status(404).json({ message: "Recipient not found" })
  }

  // Check if sender has enough balance
  if (sender.balance < amount) {
    return res.status(400).json({ message: "Insufficient funds" })
  }

  // Update balances
  sender.balance -= Number.parseFloat(amount)
  recipient.balance += Number.parseFloat(amount)

  // Create transaction records
  const timestamp = new Date().toISOString()

  // Debit transaction for sender
  const debitTransaction = {
    id: transactions.length + 1,
    from: sender.email,
    fromAccount: sender.accountNumber,
    to: recipient.email,
    toAccount: recipient.accountNumber,
    amount: Number.parseFloat(amount),
    type: "debit",
    description: description || "Transfer",
    timestamp,
    status: "completed",
  }

  // Credit transaction for recipient
  const creditTransaction = {
    id: transactions.length + 2,
    from: sender.email,
    fromAccount: sender.accountNumber,
    to: recipient.email,
    toAccount: recipient.accountNumber,
    amount: Number.parseFloat(amount),
    type: "credit",
    description: description || "Transfer",
    timestamp,
    status: "completed",
  }

  transactions.push(debitTransaction, creditTransaction)

  // Save data
  saveUsers()
  saveTransactions()

  res.json({ message: "Transfer successful", debitTransaction, creditTransaction })
})

// Admin fund user
app.post("/api/admin/fund", (req, res) => {
  const { adminId, userIdentifier, amount, description } = req.body

  // Validate input
  if (!adminId || !userIdentifier || !amount) {
    return res.status(400).json({ message: "Please provide admin ID, user identifier and amount" })
  }

  // Find admin and user
  const admin = users.find((u) => u.id === Number.parseInt(adminId))
  const user = users.find((u) => u.email === userIdentifier || u.accountNumber === userIdentifier)

  if (!admin || !admin.isAdmin) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  if (!user) {
    return res.status(404).json({ message: "User not found" })
  }

  // Check if admin has enough balance
  if (admin.balance < amount) {
    return res.status(400).json({ message: "Insufficient admin funds" })
  }

  // Update balances
  admin.balance -= Number.parseFloat(amount)
  user.balance += Number.parseFloat(amount)

  // Create transaction records
  const timestamp = new Date().toISOString()

  // Debit transaction for admin
  const debitTransaction = {
    id: transactions.length + 1,
    from: admin.email,
    fromAccount: admin.accountNumber,
    to: user.email,
    toAccount: user.accountNumber,
    amount: Number.parseFloat(amount),
    type: "debit",
    description: description || "Admin Funding",
    timestamp,
    status: "completed",
  }

  // Credit transaction for user
  const creditTransaction = {
    id: transactions.length + 2,
    from: admin.email,
    fromAccount: admin.accountNumber,
    to: user.email,
    toAccount: user.accountNumber,
    amount: Number.parseFloat(amount),
    type: "credit",
    description: description || "Admin Funding",
    timestamp,
    status: "completed",
  }

  transactions.push(debitTransaction, creditTransaction)

  // Save data
  saveUsers()
  saveTransactions()

  res.json({ message: "User funded successfully", debitTransaction, creditTransaction })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
