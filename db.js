const db = new Dexie("AmazingDecoraDB_v4");

db.version(1).stores({
    orders: '++id, customerName, status, date, completionDate, timestamp',
    expenses: '++id, date, category, timestamp, isoMonth',
    stock: 'itemSize, quantity',
    prices: 'itemName, price',
    customers: '++id, name, phone',
    expenseCategories: 'name',
    attendance: '++id, date, employeeName, timestamp',
    employees: 'name'
});

// Initial Stock Data with new naming format
const initialSizes = [
    "1.5 feet (Wood)", "2.0 feet (Wood)", "2.5 feet (Wood)", "3.0 feet (Wood)", "3.5 feet (Wood)", "4.0 feet (Wood)",
    "1.5 feet (PVC)", "2.0 feet (PVC)", "2.5 feet (PVC)", "3.0 feet (PVC)", "3.5 feet (PVC)", "4.0 feet (PVC)",
    "Ladder 3.0ft", "Ladder 4.0ft",
    "Coir Pot Size 1", "Coir Pot Size 2", "Coir Pot Size 3",
    "Orchid Support 12x12", "Orchid Support 12x14"
];

// Default prices for items
const defaultPrices = {
    "1.5 feet (Wood)": 150,
    "2.0 feet (Wood)": 200,
    "2.5 feet (Wood)": 250,
    "3.0 feet (Wood)": 300,
    "3.5 feet (Wood)": 350,
    "4.0 feet (Wood)": 400,
    "1.5 feet (PVC)": 100,
    "2.0 feet (PVC)": 150,
    "2.5 feet (PVC)": 200,
    "3.0 feet (PVC)": 250,
    "3.5 feet (PVC)": 300,
    "4.0 feet (PVC)": 350,
    "Ladder 3.0ft": 500,
    "Ladder 4.0ft": 600,
    "Coir Pot Size 1": 50,
    "Coir Pot Size 2": 75,
    "Coir Pot Size 3": 100,
    "Orchid Support 12x12": 120,
    "Orchid Support 12x14": 140
};

// Default expense categories
const defaultExpenseCategories = [
    "Wood", "PVC", "Coir", "Wrapping Sheets", "Glue Tape", "Stickers",
    "Wire Mesh", "Screws", "Transport", "Sugar/Tea", "Snacks",
    "Home Expenses", "Salaries", "Tools"
];

// Default employees
const defaultEmployees = [
    "නිලුකා", "සුරන්ගී", "රම්යලතා", "ස්වර්නා", "තුශාරිකා"
];

async function initDatabase() {
    // Initialize stock items
    for (let s of initialSizes) {
        const exists = await db.stock.get(s);
        if (!exists) {
            await db.stock.add({ itemSize: s, quantity: 0 });
        }
    }

    // Initialize prices
    for (let itemName in defaultPrices) {
        const exists = await db.prices.get(itemName);
        if (!exists) {
            await db.prices.add({ itemName: itemName, price: defaultPrices[itemName] });
        }
    }

    // Initialize expense categories
    for (let category of defaultExpenseCategories) {
        const exists = await db.expenseCategories.get(category);
        if (!exists) {
            await db.expenseCategories.add({ name: category });
        }
    }

    // Initialize employees
    for (let employee of defaultEmployees) {
        const exists = await db.employees.get(employee);
        if (!exists) {
            await db.employees.add({ name: employee });
        }
    }

    console.log("Database initialized with stock items, prices, expense categories, and employees.");
}
