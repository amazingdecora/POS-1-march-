export interface StockRow {
  item_size: string;
  quantity: number;
}

export interface Deduction {
  item: string;
  qty: number;
}

/**
 * Parse order details text and deduct stock (legacy behaviour from app.js).
 */
export async function parseAndDeductStock (
  detailsText: string,
  getAllStock: () => Promise<StockRow[]>,
  updateQty: (itemSize: string, newQty: number) => Promise<void>
): Promise<Deduction[]> {
  const lines = detailsText.split(/[\n,]/);
  const allStock = await getAllStock();
  allStock.sort((a, b) => b.item_size.length - a.item_size.length);

  const deductions: Deduction[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let qty = 1;
    let cleanLine = line;

    const suffixMatch = line.match(/[*xX]\s*(\d+)$/);
    if (suffixMatch) {
      qty = parseInt(suffixMatch[1], 10);
      cleanLine = line.substring(0, suffixMatch.index).trim();
    } else {
      const prefixMatch = line.match(/^(\d+)\s*[*xX]?\s*/);
      if (prefixMatch) {
        qty = parseInt(prefixMatch[1], 10);
        cleanLine = line.substring(prefixMatch[0].length).trim();
      }
    }

    let normalizedInput = cleanLine.toLowerCase();
    normalizedInput = normalizedInput.replace(/\bfeet\b|\bfoot\b/g, 'ft');
    normalizedInput = normalizedInput.replace(/(\d)\s+ft/g, '$1ft');
    normalizedInput = normalizedInput.replace(/(^|\s)(\d+)ft/g, '$1$2.0ft');

    const matchedItem = allStock.find(stockItem => {
      const stockName = stockItem.item_size.toLowerCase();
      const stockTokens = stockName.split(/\s+/);
      const inputTokens = normalizedInput.split(/\s+/);
      return stockTokens.every(token => inputTokens.some(it => it.includes(token)));
    });

    if (matchedItem) {
      const newQty = Math.max(0, matchedItem.quantity - qty);
      await updateQty(matchedItem.item_size, newQty);
      matchedItem.quantity = newQty;

      const existingDeduction = deductions.find(d => d.item === matchedItem.item_size);
      if (existingDeduction) existingDeduction.qty += qty;
      else deductions.push({ item: matchedItem.item_size, qty });
    }
  }
  return deductions;
}
