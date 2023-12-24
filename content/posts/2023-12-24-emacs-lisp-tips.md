---
title: Leveraging Emacs 29.1  Use-Package and Other emacs lisp tips
date: 2023-12-24T02:51:47+0800
tags: [emacs, lisp]
---
## built-in use-package 
As a seasoned Emacs user, I've been eagerly anticipating the built-in arrival of use-package in version 29.1. And now it's finally here! This [declarative configuration tool](https://www.masteringemacs.org/article/spotlight-use-package-a-declarative-configuration-tool) has already become my go-to for confining all the chaotic Emacs configurations, making everything more organized and manageable. So, if you haven't already, I'd wholeheartedly recommend upgrading your Emacs to the latest version 29.1.

## Tips for Checking Package Installation 

When you're neck-deep in code, it's quite common to forget whether you've installed a particular package or not. Emacs has got you covered with several commands: 

- featurep: Use this if a package ends with provide. 
- fboundp: This comes in handy when you need to check if a certain function is defined. 
- bound-and-true-p: Use this to confirm whether a global minor mode is both installed and activated.

## The Power of cl-letf 

I've found [**cl-letf**](https://www.gnu.org/software/emacs/manual/html_mono/cl.html#Macros) to be incredibly useful when I need to dynamically and temporarily override functions and values defined externally. It's particularly handy when paired with advice, allowing me to alter the behavior of third-party packages without meddling with their source code.

Here's a practical example of how to override a function defined in a package. The code modifies the behavior of original-split-window-horizontally inside create-window so that no matter what argument it receives, a fixed width is used:
(defun my-create-window-advice (orig-fun &rest args)
  "Advice to modify the behavior of `split-window-horizontally' in `create-window'."
  (let ((original-split-window-horizontally (symbol-function 'split-window-horizontally))
        (fixed-width 20)))
    (cl-letf (((symbol-function 'split-window-horizontally)
               (lambda (&optional size)
                 (funcall original-split-window-horizontally fixed-width))))
      (apply orig-fun args))))

(advice-add 'create-window :around #'my-create-window-advice)
 

## Embracing thread-first and thread-last Macros

One of my favorite features of Emacs version 25 and onwards is the built-in thread-first and thread-last macros. These can prove immensely useful when dealing with complex data transformations - they help maintain clean and readable code.

In Emacs Lisp, the thread-first (`->`) and thread-last (`->>`) macros are powerful tools for improving the readability of function call sequences. They allow for a more intuitive and linear style of writing nested function calls, especially useful in situations where you have multiple operations that need to be applied in sequence.

###  thread-first (`->`) Macro:

The thread-first macro (`->`) takes the first argument and threads it as the second item in the next form, and so on. This is particularly useful when the output of one function is the input of the next.

#### Example:
(-> (list 1 2 3)
    (mapcar (lambda (x) (+ x 1)))
    (seq-filter (lambda (x) (> x 2))))

In this example, the list (1 2 3) is first passed to mapcar, which increments each element. The result is then passed to seq-filter, which filters out elements less than or equal to 2. The macro makes it clear that the operations are applied in sequence.

### thread-last (`->>`) Macro:

The thread-last macro (`->>`) is similar to thread-first, but it threads the first argument as the last item in the next form. This is useful when the function takes the primary input as its last argument.

##### Example:
(->> (list 1 2 3)
     (mapcar (lambda (x) (+ x 1)))
     (seq-remove (lambda (x) (<= x 2))))

Here, the same operations are applied as in the thread-first example. However, the ->> macro is used, which would be more suitable if the functions being applied expected their main argument as the last parameter.