---
title: Usage of Result type in Gleam/Rust
post: 2024-07-01-usage-of-result-type-in-gleam-rust.md
date: 2024-07-01T15:32:21+0800
tags: [gleam, type_system]
---
# typical usage of result.unwrap and result.or

`result.unwrap` and `result.or` are both useful functions in Gleam for working with Result types, but they serve different purposes.

## result.unwrap

`result.unwrap` is used to extract the value from a Result, providing a default value if the Result is an Error. It's typically used when you want to proceed with a default value rather than propagating an error.

Typical usage:

```gleam
import gleam/result

pub fn get_user_name(user_id: Int) -> Result(String, Nil) {
  // Simulated user lookup
  case user_id {
    1 -> Ok("Alice")
    2 -> Ok("Bob")
    _ -> Error(Nil)
  }
}

pub fn greet_user(user_id: Int) -> String {
  let name = get_user_name(user_id)
    |> result.unwrap("Guest")

  "Hello, " <> name
}

// Usage:
pub fn main() {
  io.println(greet_user(1))  // Prints: "Hello, Alice"
  io.println(greet_user(3))  // Prints: "Hello, Guest"
}
```

In this example, `result.unwrap` allows us to use a default value ("Guest") when the user lookup fails, ensuring that we always have a name to greet.

## result.or

`result.or` is used to provide an alternative Result when the first Result is an Error. It's typically used when you have a fallback operation or value that you want to try if the primary operation fails.

Typical usage:

```gleam
import gleam/result

pub fn get_config_from_file() -> Result(Config, String) {
  // Simulated file read
  Error("File not found")
}

pub fn get_default_config() -> Result(Config, String) {
  // Return a default configuration
  Ok(Config(..))
}

pub fn get_config() -> Result(Config, String) {
  get_config_from_file()
  |> result.or(get_default_config())
}

// Usage:
pub fn main() {
  case get_config() {
    Ok(config) -> io.println("Config loaded")
    Error(err) -> io.println("Failed to load config: " <> err)
  }
}
```

In this example, `result.or` allows us to try loading the configuration from a file first, and if that fails, fall back to using a default configuration. The `get_config` function will only return an Error if both operations fail.

Key differences and when to use each:

- Use `result.unwrap` when you want to extract a value from a Result and have a sensible default to use if it's an Error. This effectively "throws away" the error information.
- Use `result.or` when you want to try an alternative operation if the first one fails, while still preserving the Result type. This allows you to chain multiple fallback options.
- `result.unwrap` returns the unwrapped value directly, while `result.or` returns another Result.
- `result.unwrap` is often used **at the "edges" of your program** where you need to interface with code that doesn't use Results, while `result.or` is more commonly used within the "core" logic where you're **still working with Results**.

Both functions are valuable tools for error handling in Gleam, and understanding when to use each can lead to more robust and expressive code.

## Rust
Same principle can be applied to Rust as the design is very alike.