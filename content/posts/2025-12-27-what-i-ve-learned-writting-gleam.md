---
title: "What I've Learned Writing Gleam"
post: 2025-12-27-what-i-ve-learned-writting-gleam.md
date: 2025-12-27T02:30:50+0800
tags: [gleam, programming]
---
Coming from Python, picking up Gleam required a fundamental shift in how I approach writing code. It's not just learning new syntax—it's adopting a different mental model. Here's what clicked for me after spending time with the language.

## Think in Function Signatures First

In Python, I often dive straight into implementation. I'll start typing the function body and figure out the types as I go. Gleam pushed me toward a different workflow: define the function signature first, compose the overall flow, then implement the details.

```gleam
// Step 1: Define the signatures
fn parse_config(raw: String) -> Result(Config, ParseError)

fn validate_config(config: Config) -> Result(Config, ValidationError)

fn apply_config(config: Config) -> Result(Nil, ApplyError)

// Step 2: Compose the flow
pub fn load_and_apply_config(path: String) -> Result(Nil, ConfigError) {
  use raw <- result.try(read_file(path))
  use config <- result.try(parse_config(raw))
  use validated <- result.try(validate_config(config))
  apply_config(validated)
}

// Step 3: Now implement parse_config, validate_config, etc.
```

This top-down approach forces me to think about the data flow and error cases before getting lost in implementation details. The compiler keeps me honest—I can't just leave a `TODO` and move on without addressing the types.

## Keep Code Flat with Early Returns

Nested code is harder to read. In imperative languages, we use early returns to bail out of functions. In Gleam, the `use` keyword with `result.try` achieves the same flat structure.

Instead of nesting Results:

```gleam
// Nested and hard to follow
fn process_user(id: String) -> Result(User, Error) {
  case fetch_user(id) {
    Error(e) -> Error(e)
    Ok(user) -> {
      case validate_user(user) {
        Error(e) -> Error(e)
        Ok(valid_user) -> {
          case enrich_user(valid_user) {
            Error(e) -> Error(e)
            Ok(enriched) -> Ok(enriched)
          }
        }
      }
    }
  }
}
```

Use `result.try` for flat, readable code:

```gleam
// Flat and clear
fn process_user(id: String) -> Result(User, Error) {
  use user <- result.try(fetch_user(id))
  use valid_user <- result.try(validate_user(user))
  use enriched <- result.try(enrich_user(valid_user))
  Ok(enriched)
}
```

Each `use` line acts like an early return. If any step fails, the function returns that error immediately. The happy path reads top to bottom.

## Default Values with result.unwrap

When a failure isn't fatal and you have a sensible default, `result.unwrap` keeps things simple:

```gleam
import gleam/result

// Instead of pattern matching for a default
let timeout = case parse_timeout(config) {
  Ok(t) -> t
  Error(_) -> 30
}

// Use unwrap
let timeout = result.unwrap(parse_timeout(config), 30)

// Or with a lazy default (computed only if needed)
let cache_size = result.lazy_unwrap(parse_cache_size(config), fn() {
  calculate_default_cache_size()
})
```

## Boolean Guards for Conditional Logic

`bool.guard` and `bool.lazy_guard` replace simple if-else patterns with a more functional style:

```gleam
import gleam/bool

fn divide(a: Int, b: Int) -> Result(Int, String) {
  use <- bool.guard(b == 0, Error("division by zero"))
  Ok(a / b)
}
```

The guard checks the condition. If true, it returns the second argument immediately. Otherwise, execution continues. `lazy_guard` delays evaluation of the fallback value:

```gleam
fn get_cached_or_fetch(key: String) -> Data {
  use <- bool.lazy_guard(cache_has(key), fn() { cache_get(key) })
  // Only runs if cache miss
  let data = fetch_from_database(key)
  cache_set(key, data)
  data
}
```

## Pattern Matching Multiple Variables

Gleam lets you match on tuples to handle combinations of values cleanly:

```gleam
fn handle_response(status: Status, body: Option(String)) -> String {
  case status, body {
    Success, Some(data) -> "Got: " <> data
    Success, None -> "Success but empty"
    NotFound, _ -> "Resource not found"
    Error, Some(msg) -> "Error: " <> msg
    Error, None -> "Unknown error"
  }
}
```

This is cleaner than nested conditionals and makes all cases explicit. The compiler ensures I've covered every combination.

## Thinking in Effect Types

The biggest mental shift was learning to think about effect types upfront. In Python, I might write a function and later realize it needs to do I/O or might fail. In Gleam, I ask myself before writing:

**Does this function perform effects?** If it reads files, makes network calls, or accesses mutable state, the return type should reflect that.

**Can this function fail?** Then it returns `Result(T, E)`.

**Might the value be absent?** Then it returns `Option(T)`.

```gleam
// Pure function - no effects
fn calculate_total(items: List(Item)) -> Int {
  list.fold(items, 0, fn(acc, item) { acc + item.price })
}

// Effectful function - can fail
fn fetch_items(user_id: String) -> Result(List(Item), DbError) {
  // database call
}

// Compose them with awareness of effects
fn get_user_total(user_id: String) -> Result(Int, DbError) {
  use items <- result.try(fetch_items(user_id))
  Ok(calculate_total(items))
}
```

## Start Simple, Extract When Needed

I've adopted a pattern: write the basic case inline first, then extract helper functions for complex logic.

```gleam
fn format_name(user: User) -> String {
  // Start with the basic case
  case user.display_name {
    Some(name) -> name
    None -> user.first_name <> " " <> user.last_name
  }
}

// Later, when formatting gets complex, extract it
fn format_name(user: User) -> String {
  user.display_name
  |> option.lazy_unwrap(fn() { build_full_name(user) })
}

fn build_full_name(user: User) -> String {
  [user.first_name, user.middle_name, user.last_name]
  |> list.filter(fn(s) { s != "" })
  |> string.join(" ")
}
```

This keeps the initial implementation simple and makes refactoring straightforward.

## Wrapping Up

Gleam's type system isn't a constraint—it's a design tool. By thinking in types first, handling errors explicitly, and using the standard library's Result and Option combinators, I write code that's easier to reason about and harder to break.

The functional programming patterns took time to internalize, but now they feel natural. Each function declares its effects in its type signature. Each error case is handled explicitly. And the compiler catches the mistakes before they become bugs.
