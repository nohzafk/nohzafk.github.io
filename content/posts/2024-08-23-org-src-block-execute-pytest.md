---
title: org src-block execute pytest
post: 2024-08-23-org-src-block-execute-pytest.md
date: 2024-08-23T14:50:38+0800
tags: [emacs, python]
---
I recently wanted to practice some LeetCode and write documents and code in an **org** file. To quickly test the code, I wanted to use {#C-c C-c} on a **src-block** to run `pytest`. I created this snippet to enable that functionality.

```lisp
(after! org
  (defun org-babel-execute:python-with-pytest (body params)
    "Execute a python source block with pytest if :pytest is specified."
    (if (assq :pytest params)
        (let* ((temporary-file-directory ".")
               (temp-file (make-temp-file "pytest-" nil ".py")))
          (with-temp-file temp-file
            (insert body))
          (unwind-protect
              (org-babel-eval (format "pytest -v -s %s" temp-file) "")
            (delete-file temp-file)))
      (org-babel-execute:python-default body params)))

  (advice-add 'org-babel-execute:python :override #'org-babel-execute:python-with-pytest))
```

usage example

```python
#+begin_src python :pytest
def test():
    assert Solution().mergeAlternately("abc", "pqr") == "apbqcr"
    assert Solution().mergeAlternately("ab", "pqrs") == "apbqrs"
    assert Solution().mergeAlternately("abcd", "pq") == "apbqcd"

class Solution:
    def mergeAlternately(self, word1: str, word2: str) -> str:
        longest = max(len(word1), len(word2))

        def get_char(i, chs):
            return chs[i] if i < len(chs) else ""

        r = []
        for i in range(0, longest):
            r.append(get_char(i, word1))
            r.append(get_char(i, word2))

        return "".join(r)
#+end_src
```

I used the built-in `tempo` to create a template. This allows me to run {#M-x insert-leetcode-solution}, which inserts the template content and places the cursor on the line below "Problem".

```lisp
#+begin_src elisp :tangle config.el
(require 'tempo)

(tempo-define-template
  "leetcode-solution"
  '("* Problem"
    n
    p
    n
    "* Note"
    n
    "* Solution"
    n
    "#+begin_src python :pytest"
    n
    "#+end_src"
    n))

(defun insert-leetcode-solution ()
  (interactive)
  (tempo-template-leetcode-solution))
#+end_src
```