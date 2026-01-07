# PnL Calculation Guide

This document explains how the AI Trading Gym calculates Profit and Loss (PnL) for trades, specifically focusing on multi-level Take Profits (TP) and real-time floating calculations.

---

## 1. Core Formulas

### Long Position
*   **Formula**: `((Exit Price - Entry Price) / Entry Price) * Capital Allocated`
*   **Result**: Positive if price > entry, Negative if price < entry.

### Short Position
*   **Formula**: `((Entry Price - Exit Price) / Entry Price) * Capital Allocated`
*   **Result**: Positive if price < entry, Negative if price > entry.

---

## 2. Multi-TP Mechanism (Partial Closures)

When a trade is created with multiple TP levels, the position is split equally among them.

**Example Case:**
*   **Total Position Size**: $30.00
*   **Number of TPs**: 3
*   **Capital per TP**: $10.00 each

### Workflow:
1.  **TP1 Hit**: The system calculates the PnL for 1/3 of the position ($10) using the TP1 price. This amount is **banked (realized)**.
2.  **Remaining Position**: The remaining 2/3 of the position ($20) stays open.
3.  **Final Closure**: The trade ends when either all TPs are hit or the Stop Loss is triggered. The Stop Loss calculation is always performed on the **remaining capital** at that moment.

---

## 3. Real-Time (Live) PnL

The dashboard calculates "Live PnL" to show you the current value of an open trade.

**Total PnL = Realized PnL + Floating PnL**

*   **Realized PnL**: The sum of profits from all TPs already hit.
*   **Floating PnL**: The calculation on the portion of the position that is still open, using the **Current Market Price**.

---

### Case Study: Your Trade Setup ($1,000 Total)

### Setup Details (LONG)
| Parameter | Value |
| :--- | :--- |
| **Strategy** | `claude-opus-4-1-search` |
| **Entry Price** | $2,985 |
| **Stop Loss** | $2,775 |
| **TP 1** | $3,234 |
| **TP 2** | $3,447 |
| **TP 3** | $3,573 |
| **Total Capital** | **$1,000.00** |

### Stage 1: TP 1 is Hit (Price reached $3,234)
*   **Allocated Capital (1/3)**: $333.33
*   **Profit Calculation**: `(($3,234 - $2,985) / $2,985) * $333.33`
*   **Realized PnL**: **+$27.80** (Banked)
*   **Position Remaining**: $666.67

### Stage 2: Price moves to $3,200 (Current Status)
*   **Realized PnL**: $27.80
*   **Floating PnL (on $666.67)**: `(($3,200 - $2,985) / $2,985) * $666.67` = **+$48.02**
*   **Total Reported PnL**: **+$75.82** (Live)

---

## 5. Capital & Leverage (Simulation Model)

The AI Trading Gym uses a specific capital model to track performance across different strategies.

### Default Capital
*   **Total Trade Capital**: Every deal enters with exactly **$1,000.00**.
*   **Strategy Balance**: Strategies start with **$1,000.00**. Profits/Losses from deals are added to this balance.

### TP Distribution
If a trade has **N** Take Profit levels, the $1,000 capital is divided into **$1,000 / N** per level.
*   **2 TPs**: $500.00 each
*   **3 TPs**: $333.33 each

### Leverage
*   **Standard Leverage**: The system uses **1x Leverage**.
*   **Calculation**: PnL = `% Change * Allocated Capital`.
    *   Example: If $500 is allocated to TP1 and the price moves +10%, profit = **$50.00**.
*   **Note**: All deals are simulated with the full $1,000 capital regardless of current strategy balance, allowing you to track performance consistently across strategies.

---

## 6. Security & Precision
All calculations are performed using floating-point math in the logic layer (`lib/pnl-calculations.ts`) to ensure accuracy, and formatted to 2 decimal places in the UI for clarity.
