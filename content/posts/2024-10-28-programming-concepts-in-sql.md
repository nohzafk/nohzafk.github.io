---
title: programming concepts in SQL
post: 2024-10-28-programming-concepts-in-sql.md
date: 2024-10-28T00:11:22+0800
tags: [cte, group_by, sql]
---
# Programming concepts in SQL

## CTEs (Common Table Expressions) as Variables/Functions

- Just like how you declare variables or functions in traditional programming, CTEs let you create named result sets that you can reference later
- Each CTE can be thought of as storing an intermediate result, similar to variable assignment
- They can be chained together like function calls, where one CTE uses results from another

## GROUP BY as Loops

- In traditional programming, you might loop through data to accumulate results
- GROUP BY automatically "loops" through rows, grouping related records together
- The aggregation functions (SUM, COUNT, AVG) work like accumulators inside these implicit loops

Example in programming vs SQL:

```python
# Python equivalent
results = {}
for row in data:
    if row.customer_id not in results:
        results[row.customer_id] = {
            'total_transactions': 0,
            'total_spend': 0
        }
    results[row.customer_id]['total_transactions'] += 1
    results[row.customer_id]['total_spend'] += row.quantity * row.unit_price
```

```sql
-- SQL equivalent using GROUP BY
SELECT 
    customer_id,
    COUNT(*) as total_transactions,
    SUM(quantity * unit_price) as total_spend
FROM sales
GROUP BY customer_id
```

## CASE Statements as If/Switch
- Similar to if/else or switch statements in programming
- Can be used in both SELECT and WHERE clauses
- Can be nested for complex conditional logic

Example comparison:

```python
# Python equivalent
def get_spending_tier(total_spend):
    if total_spend >= 10000:
        return 'Premium'
    elif total_spend >= 5000:
        return 'Gold'
    elif total_spend >= 1000:
        return 'Silver'
    else:
        return 'Bronze'
```

```sql
-- SQL equivalent using CASE
CASE 
    WHEN total_spend >= 10000 THEN 'Premium'
    WHEN total_spend >= 5000 THEN 'Gold'
    WHEN total_spend >= 1000 THEN 'Silver'
    ELSE 'Bronze'
END as spending_tier
```

## Advanced Programming-like Features
1. Window Functions as Iterators:

```sql

SELECT 
    *,
    LAG(value) OVER (ORDER BY date) as previous_value,
    LEAD(value) OVER (ORDER BY date) as next_value
FROM data
```

This is similar to accessing previous/next elements in an array iteration.

2. Recursive CTEs as While Loops

```sql
WITH RECURSIVE countdown(val) AS (
    SELECT 10  -- Initial value
    UNION ALL
    SELECT val - 1 FROM countdown WHERE val > 1  -- Loop condition and iteration
)
SELECT * FROM countdown;
```

3. HAVING as Filter After Processing: Like applying conditions after a loop completes:

```sql
SELECT category, COUNT(*) as count
FROM items
GROUP BY category
HAVING COUNT(*) > 10
```

Key Insights:

Declarative vs Imperative:

Traditional programming is imperative (you specify HOW to do something)
SQL is declarative (you specify WHAT you want)
The SQL engine optimizes the execution plan

Set-based Operations:

Instead of thinking about individual records, think in sets
Operations like GROUP BY process entire sets of data at once
This often leads to better performance than record-by-record processing

Composition:

CTEs allow you to break complex logic into manageable pieces
Each CTE can build upon previous ones, similar to function composition
This promotes code reusability and maintainability