---
title: Common pitfalls in Python
post: 2024-08-16-common-pitfalls-in-python.md
date: 2024-08-15T22:08:48+0800
tags: [python]
---
Python is a great language but not perfect. 

There are some common pitfalls, many of these are legacy issues retained for backward compatibility. 

I want to share some of them. 

## Global Interpreter Lock (GIL)

It's 2024, but Python still struggles with multi-core utilization due to the Global Interpreter Lock (GIL).

- The GIL prevents multiple native threads from executing Python bytecode simultaneously.
- This significantly limits the effectiveness of multi-threading for CPU-bound tasks in CPython.
- While technically a CPython implementation detail, Python's lack of a formal language specification means CPython's behavior is often duplicated in other implementations.

> Historically, when Python was created, there were no multi-core CPUs. When multi-core CPUs emerged, OS started to add thread support, the author added a thread interface as well, but the implementation was essentially single-core. The intention was to add real multi-threaded implementation later, but 30 years on, Python still grapples with this issue.

The GIL's persistence is largely due to backward compatibility concerns and the fundamental changes removing it would require in the language and its ecosystem.

## Lack of Block Scope

Unlike many languages, Python doesn't have true block scope. It uses function scope and module scope instead.

```python
def example_function():
    if True:
        x = 10  # This variable is not block-scoped
    print(x)  # This works in Python, x is still accessible

example_function()  # Outputs: 10
```

Implications:

1. Loop Variable Leakage:
   ```python
   for i in range(5):
       pass
   print(i)  # This prints 4, the last value of i
   ```

2. Unexpected Variable Overwrites:
   ```python
   x = 10
   if True:
       x = 20  # This overwrites the outer x, not create a new one
   print(x)  # Prints 20
   ```

3. Difficulty in Creating Temporary Variables: It's harder to create variables that are guaranteed to be cleaned up after a block ends.

4. List Comprehension Exception: Interestingly, list comprehensions do create their own scope in Python 3.x.
   ```python
   [x for x in range(5)]
   print(x)  # This raises a NameError in Python 3.x
   ```

Best practices:
- Use functions to simulate block scope when needed.
- Be mindful of variable names to avoid accidental overwrites.
- Be cautious of the risk of using incorrect variable names in large functions.

## Mutable Objects as Default Arguments

This is a particularly tricky pitfall:

```python
def surprise(my_list = []):
    print(my_list)
    my_list.append('x')

surprise()  # Output: []
surprise()  # Output: ['x']
```

Why this happens:
- Default arguments are evaluated when the function is defined, not when it's called.
- The same list object is used for all calls to the function.

This behavior:
- Dates back to Python's early days, possibly for performance reasons or implementation simplicity.
- Goes against the "Principle of Least Astonishment".
- Has very few practical use cases and often leads to bugs.

Best practice: Use `None` as a default for mutable arguments and initialize inside the function:

```python
def better_surprise(my_list=None):
    if my_list is None:
        my_list = []
    print(my_list)
    my_list.append('x')
```

## Late Binding Closures

This issue is particularly tricky in loops:

```python
def create_multipliers():
    return [lambda x: i * x for i in range(4)]

multipliers = create_multipliers()
print([m(2) for m in multipliers])  # Outputs: [6, 6, 6, 6]
```

Explanation:
- The lambda functions capture the variable `i` itself, not its value at creation time.
- By the time these lambda functions are called, the loop has completed, and `i` has the final value of 3.

Fix: Use a default argument to capture the current value of `i`:

```python
def create_multipliers():
    return [lambda x, i=i: i * x for i in range(4)]
```

This behavior is particularly confusing because it goes against the intuitive understanding of how closures should work in many other languages.

## The `__init__.py` Requirement

In Python 2 and early versions of Python 3, a directory had to contain an `__init__.py` file to be treated as a package.

- This requirement often confused beginners and led to subtle bugs when forgotten.
- It provided a clear, explicit way to define package boundaries and behavior.

Evolution:
- Python 3.3 introduced PEP 420, allowing for implicit namespace packages.
- Directories without `__init__.py` can now be treated as packages under certain conditions.

Modern best practices:
1. Use `__init__.py` when you need initialization code or to control package exports.
2. For simple packages or namespace packages, you can often omit `__init__.py` in Python 3.

Understanding these pitfalls is crucial for writing efficient, bug-free Python code. While they can be frustrating, they're part of Python's evolution and often retained for backward compatibility. Being aware of them will help you navigate Python development more effectively.