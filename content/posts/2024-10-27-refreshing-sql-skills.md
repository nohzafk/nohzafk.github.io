---
title: refreshing SQL skills
post: 2024-10-27-refreshing-sql-skills.md
tags: [[sql, tutorial]]
date: 2024-10-28T00:10:42+0800
---
Recently I refreshed my SQL knowledge, and finished [Learn Advanced SQL Tutorials | Kaggle](https://www.kaggle.com/learn/advanced-sql/course). Highly recommend the Analytic Functions Exercise Section.

I want to share some of my notes and the materials I used. This is going to be a long post.

There are some topics that developers should be familiar with, even if they don't work on database directly. There topics are:
- JOIN & UNION
- Common Table Expression (CTE)
- Analytic Functions (or Window Functions)

# JOIN
JOIN is equivalent to **INNER JOIN**

there are:
- INNER JOIN
- LEFT JOIN
- RIGHT JOIN

## Best practices

Performance:
- Consider indexing join columns
- Use **WHERE** clauses to filter results when possible

# UNION
UNION: to stack data on top of each other

UNION is equivalent to **UNION DISTINCT**
there are
- UNION DISTINCT
- UNION ALL

Syntax

```sql
SELECT column1 FROM table1
UNION [DISTINCT | ALL]
SELECT column1 FROM table2

```

UNION (or UNION DISTINCT)
- Combines results from two or more SELECT statements
- Automatically removes duplicate rows
- Returns only unique rows
- Requires compatible columns (same number and compatible data types)
- More computationally expensive due to duplicate removal

Example: query unique user id that create at least one question or one answer

```sql
SELECT owner_user_id
FROM `bigquery-public-data.stackoverflow.posts_questions`
WHERE DATE(creation_date) = '2019-01-01'
UNION DISTINCT
SELECT owner_user_id
FROM `bigquery-public-data.stackoverflow.posts_answers`
WHERE DATE(creation_date) = '2019-01-01'
```

## Core Concept: Position-Based Matching
UNION DISTINCT (or UNION) compares rows based on ALL columns in the corresponding positions, regardless of their names. What matters is:

- Column position (order)
- Data types (must be compatible)
- Values in all columns

## Common Pitfalls

data type mismatches

```sql

-- Might fail due to type mismatch
SELECT employee_id FROM employees  -- integer
UNION
SELECT employee_code FROM contractors;  -- varchar
```

column order importance

```sql
-- These produce different results
SELECT firstname, lastname FROM employees
UNION
SELECT lastname, firstname FROM contractors;
```

# Understanding Common Table Expression (CTE)

## What are CTEs?

Common Table Expressions (CTEs) are temporary named result sets that exist only within the scope of a single SQL statement. They're defined using the WITH clause and can be thought of as "named subqueries" that make complex queries more readable and maintainable.

History

Common Table Expressions (CTEs) are part of the SQL standard

- CTEs were first introduced in SQL:1999 (also known as SQL3)
- Recursive CTEs were also included in this standard
- The syntax using the WITH clause became part of the ANSI/ISO SQL standard

## Basic Syntax

```sql
WITH cte_name AS (
    -- CTE query definition
    SELECT column1, column2
    FROM table_name
    WHERE condition
)
-- Main query that uses the CTE
SELECT *
FROM cte_name;
```

- Break complex queries into manageable, named components. Easy to maintain and debug
- Can reference the same CTE multiple times in a query. Avoid repeating complex subqueries
- Recursive calling, can reference themselves to handle hierarchical or graph-like data

### Example

#### Multiple CTEs

```sql
WITH 
monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', sale_date) as month,
        SUM(amount) as revenue
    FROM sales
    GROUP BY DATE_TRUNC('month', sale_date)
),
sales_growth AS (
    SELECT 
        month,
        revenue,
        LAG(revenue) OVER (ORDER BY month) as prev_month_revenue
    FROM monthly_sales
)
SELECT 
    month,
    revenue,
    prev_month_revenue,
    ((revenue - prev_month_revenue) / prev_month_revenue * 100) as growth_percentage
FROM sales_growth;
```

#### Recursive CTE example (Employee Hierachy)

```sql
WITH RECURSIVE emp_hierarchy AS (
    -- Base case: top-level employees (no manager)
    SELECT 
        employee_id,
        name,
        manager_id,
        1 as level
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    -- Recursive case: employees with managers
    SELECT 
        e.employee_id,
        e.name,
        e.manager_id,
        h.level + 1
    FROM employees e
    INNER JOIN emp_hierarchy h ON e.manager_id = h.employee_id
)
SELECT 
    employee_id,
    name,
    level,
    REPEAT('  ', level - 1) || name as org_chart
FROM emp_hierarchy
ORDER BY level, name;
```

## Advanced Concepts
a) Materialization:

- CTEs are typically materialized (computed once and stored in memory)
- Can improve performance when referenced multiple times
- Some databases optimize by not materializing if referenced only once

b) Scope:

- CTEs are only available within the statement where they're defined
- Can't be referenced across different statements
- Can reference earlier CTEs in the same WITH clause

c) Best Practices:

- Use meaningful names that describe the data or transformation
- Break complex logic into smaller, focused CTEs
- Consider performance implications for large datasets
- Use comments to explain complex logic

## Comparison with other SQL Features

CTEs vs Subqueries:

- CTEs are more readable
- CTEs can be reused in the same query
- CTEs support recursion
- CTEs can sometimes perform better due to materialization

CTEs vs Views:

- CTEs are temporary and query-scoped
- Views are permanent database objects
- CTEs can be recursive
- Views can be indexed

# Analytic Functions (or Window Functions)

Analytic functions are sometimes referred to as **analytic window functions** or simply **window functions**

## Basic Concept

Window functions perform calculations across a set of table rows that are somehow **related to the current row**. The key difference from regular aggregate functions is that window functions **don't collapse rows** - each row keeps its separate identity while gaining additional computed values.

Think of adding a column that calculate base on a set of rows without collasping rows as **GROUP BY** does.

```sql
CREATE TABLE employee_sales (
    emp_id INT,
    emp_name VARCHAR(50),
    department VARCHAR(50),
    sale_amount DECIMAL(10,2),
    sale_date DATE
);

INSERT INTO employee_sales VALUES
(1, 'John', 'Electronics', 1000, '2024-01-01'),
(1, 'John', 'Electronics', 1200, '2024-01-02'),
(2, 'Sarah', 'Electronics', 800, '2024-01-01'),
(2, 'Sarah', 'Electronics', 1500, '2024-01-02'),
(3, 'Mike', 'Furniture', 2000, '2024-01-01'),
(3, 'Mike', 'Furniture', 2500, '2024-01-02');

```

## Basic Window Function Syntax

The basic syntax is:

```sql
function_name() OVER (
    [PARTITION BY column1, column2, ...] -- create group
    [ORDER BY column3, column4, ...]     -- order inside the group
    [ROWS/RANGE BETWEEN ... AND ...]     -- widnow frame clause
)
```

## Common Window Functions

### Aggregate functions

take all of the values within the window as input and return a single value

- MIN()
- MAX()
- AVG()
- SUM()
- COUNT()

### Navigation functions

Assign a value based on the value in a (usually) different row than the current row.

- **FIRST_VALUE()** (or **LAST_VALUE()**) - Returns the first (or last) value in the input
- **LEAD()** (and **LAG()**) - Returns the value on a subsequent (or preceding) row

### Numbering functions
- **ROW_NUMBER()** - Returns the order in which rows appear in the input (starting with `1`)
- **RANK()** - All rows with the same value in the ordering column receive the same rank value, where the next row receives a rank value which increments by the number of rows with the previous rank value.

## Core Concept: Window Frames

Window frames define which rows to include in the window calculation:

```sql
SELECT 
    emp_name,
    sale_date,
    sale_amount,
    AVG(sale_amount) OVER (
        PARTITION BY emp_name 
        ORDER BY sale_date
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) as moving_avg
FROM employee_sales;
```

### window frame clause example

```sql
-- window frame cluse
ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
ROWS BETWEEN 1 FOLLWING AND CURRENT ROW
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW

-- no need to say AND CURRENT ROW, totaly 7 rows, current row is included
ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
```

## Core Concept: Understand the OVER Clause - The Window Creator

Think of OVER as opening a "window" through which you look at your data. It's like saying "calculate this function OVER this specific set of rows."
Simple example:

```sql
-- Without OVER (regular SUM)
SELECT department, SUM(salary) 
FROM employees 
GROUP BY department;

-- With OVER (window function)
SELECT 
    employee_name,
    department,
    salary,
    SUM(salary) OVER() as total_salary
FROM employees;
```

Key difference:

- Without OVER: You get one row per department
- With OVER: You keep ALL rows, but each row shows the total salary

Let's use a sample table to make this clearer:

```sql
CREATE TABLE employees (
    name VARCHAR(50),
    department VARCHAR(50),
    salary INT
);

INSERT INTO employees VALUES
('John', 'IT', 60000),
('Mary', 'IT', 70000),
('Steve', 'HR', 55000),
('Jane', 'HR', 65000);
```

Example 1: Simple OVER

```sql
SELECT 
    name,
    department,
    salary,
    SUM(salary) OVER() as company_total
FROM employees;
```

Result:

```text
name    department    salary    company_total
John    IT           60000     250000
Mary    IT           70000     250000
Steve   HR           55000     250000
Jane    HR           65000     250000
```

Every row shows the company total (250000) while keeping individual salary information.

## Core Concept: PARTITION BY - Creating Groups

PARTITION BY divides your data into groups (partitions) for the window function to operate on separately. It's similar to GROUP BY, but it doesn't collapse the rows.
Think of it like this:

- GROUP BY: Combines rows into one summary row
- PARTITION BY: Keeps all rows but performs calculations within each group

Example 2: Using PARTITION BY

```sql
SELECT 
    name,
    department,
    salary,
    SUM(salary) OVER(PARTITION BY department) as dept_total
FROM employees;
```

Result:

```text
name    department    salary    dept_total
John    IT           60000     130000    -- Sum of IT salaries
Mary    IT           70000     130000    -- Sum of IT salaries
Steve   HR           55000     120000    -- Sum of HR salaries
Jane    HR           65000     120000    -- Sum of HR salaries
```

Let's break down what happened:

PARTITION BY department split the data into two groups: IT and HR
SUM(salary) was calculated separately for each group
Each employee still has their own row, but now shows their department's total

## Visual Explanation
Let's imagine a more visual example with sales data:

```sql
CREATE TABLE sales (
    salesperson VARCHAR(50),
    region VARCHAR(50),
    sale_amount INT,
    sale_date DATE
);

INSERT INTO sales VALUES
('Tom', 'North', 100, '2024-01-01'),
('Tom', 'North', 150, '2024-01-02'),
('Lisa', 'South', 200, '2024-01-01'),
('Lisa', 'South', 250, '2024-01-02');
```

Three different ways to use window functions:

1. No Partitioning:

```sql
SELECT 
    salesperson,
    sale_amount,
    SUM(sale_amount) OVER() as total_sales
FROM sales;
```

Result:

```text
salesperson    sale_amount    total_sales
Tom           100            700  -- Company total
Tom           150            700  -- Company total
Lisa          200            700  -- Company total
Lisa          250            700  -- Company total
```

2. With PARTITION BY:

```sql
SELECT 
    salesperson,
    sale_amount,
    SUM(sale_amount) OVER(PARTITION BY salesperson) as person_total
FROM sales;
```

Result:

```sql
salesperson    sale_amount    person_total
Tom           100            250  -- Tom's total
Tom           150            250  -- Tom's total
Lisa          200            450  -- Lisa's total
Lisa          250            450  -- Lisa's total
```

3. With PARTITION BY and ORDER BY:

```sql
SELECT 
    salesperson,
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER(
        PARTITION BY salesperson 
        ORDER BY sale_date
    ) as running_total
FROM sales;
```

Results:

```sql
salesperson    sale_date    sale_amount    running_total
Tom           2024-01-01   100            100  -- First day
Tom           2024-01-02   150            250  -- First + Second day
Lisa          2024-01-01   200            200  -- First day
Lisa          2024-01-02   250            450  -- First + Second day
```

**ORDER BY** in OVER Clause is often used to creating a **running total** report

4. Key Points to Remember:

- OVER() without PARTITION BY: Calculates across ALL rows
- OVER(PARTITION BY x): Calculates separately for each group of x
- You always keep all your original rows
- Each row can show both its individual value AND the calculation result

##  Practical Use Cases
### Calculating Moving Averages

```sql
SELECT 
    sale_date,
    sale_amount,
    AVG(sale_amount) OVER (
        ORDER BY sale_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as moving_avg_3_days
FROM employee_sales;
```

### Calculating Percentages of Total

```sql
SELECT 
    emp_name,
    department,
    sale_amount,
    sale_amount / SUM(sale_amount) OVER (PARTITION BY department) * 100 as pct_of_dept_sales
FROM employee_sales;
```

### Running Total of Sales

```sql
CREATE TABLE monthly_sales (
    month VARCHAR(10),
    sales INT
);

INSERT INTO monthly_sales VALUES
('January', 1000),
('February', 1500),
('March', 1200),
('April', 1800);

SELECT 
    month,
    sales,
    SUM(sales) OVER(ORDER BY sales) as running_total_by_amount,
    SUM(sales) OVER(ORDER BY month) as running_total_by_month
FROM monthly_sales;
```

Results:

```text
month     sales    running_total_by_amount    running_total_by_month
January   1000     1000                       1000
March     1200     2200                       2500  -- Jan + Feb
February  1500     3700                       4200  -- Jan + Feb + Mar
April     1800     5500                       5500  -- All months
```

### Compare with Previous Sale

```sql
SELECT 
    month,
    sales,
    LAG(sales) OVER(ORDER BY month) as previous_month,
    sales - LAG(sales) OVER(ORDER BY month) as difference
FROM monthly_sales;
```

Result:

```text
month     sales    previous_month    difference
January   1000     NULL              NULL
February  1500     1000              500
March     1200     1500              -300
April     1800     1200              600
```

### Calculate with Previous row

prev\_break column shows the length of the break (in minutes) that the driver had before each trip started (this corresponds to the time between trip_start_timestamp of the current trip and trip_end_timestamp of the previous trip).

```sql
SELECT taxi_id,
    trip_start_timestamp,
    trip_end_timestamp,
    TIMESTAMP_DIFF(
        trip_start_timestamp, 
        LAG(trip_end_timestamp) 
            OVER (
                PARTITION BY taxi_id 
                ORDER BY trip_start_timestamp), 
        MINUTE) as prev_break
FROM `bigquery-public-data.chicago_taxi_trips.taxi_trips`
WHERE DATE(trip_start_timestamp) = '2013-10-03'
```

## Best Practices
- Always specify ORDER BY in window functions when using aggregate functions
- Use appropriate indexes for columns in PARTITION BY and ORDER BY
- Be careful with frame specifications as they can impact performance
- Test with small datasets first

## Why window functions were invented

Historical Context:

Before window functions (prior to SQL:2003), developers faced several challenges:

The GROUP BY Dilemma

- You either got detail rows OR aggregated results, never both
- Had to use complex subqueries or self-joins for analytics
- Example problem: "Show each sale AND its percentage of total sales"

Complex Analytics Requirements

- Business users needed running totals, rankings, moving averages
- Solutions were inefficient and hard to maintain
- Required multiple passes over the data

# Date function

```sql
-- on that day
WHERE DATE(creation_date) = '2019-01-01'
-- between days
WHERE creation_date >= '2019-01-01' AND creation_date < '2019-02-01'
--- on that year
WHERE EXTRACT(YEAR from creation_date) = '2019' 

```