---
title: read file content in Gleam
post: 2025-03-23-read-file-content-in-gleam.md
date: 2025-03-24T03:30:39+0800
tags: [beam, erlang, gleam]
---
To my surprise when you search for `gleam read file` in google, they are not much helpful information in the first page and no code example.

There are a post in Erlang Forums where the author of Gleam language pointed to a module that no longer exists in `gleam_erlang` pacakge, and a abandoned pacakge call gleam_file, and a couple pacakges like `simplifile`.

It turns out that Gleam has excellent FFI that if you are running it on BEAM (which is the default option unless you compile Gleam to javascript), for a simple case you just need to import the function from erlang, in just two lines of code.

```rust
@external(erlang, "file", "read_file")
fn read_file(file_path: String) -> Result(String, Nil)
```

and you can use it as a normal function to read the file content into a string.

```rust
pub fn read_file_as_string(path: String) {
  use content <- result.try(
    read_file(path)
    |> result.map_error(fn(_) { "Failed to read file: " <> path }),
  )
  content
}
```