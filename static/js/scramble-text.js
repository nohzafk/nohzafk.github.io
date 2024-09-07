document.addEventListener('DOMContentLoaded', (event) => {
    class TextScramble {
        constructor() {
            this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}:"<>?|[];,./`~';
            this.queue = [];
            this.frame = null;
            this.frameRequest = null;
        }

        scramble(element, duration = 1000) {
            return new Promise((resolve) => {
                const originalText = element.textContent;
                let startTime = null;

                const animateText = (currentTime) => {
                    if (!startTime) startTime = currentTime;
                    const elapsedTime = currentTime - startTime;
                    const progress = Math.min(elapsedTime / duration, 1);

                    let currentText = '';
                    for (let i = 0; i < originalText.length; i++) {
                        if (i < progress * originalText.length) {
                            currentText += originalText[i];
                        } else {
                            currentText += this.getRandomChar();
                        }
                    }

                    element.textContent = currentText;

                    if (progress < 1) {
                        this.frame = requestAnimationFrame(animateText);
                    } else {
                        resolve();
                    }
                };

                cancelAnimationFrame(this.frame);
                this.frame = requestAnimationFrame(animateText);
            });
        }

        getRandomChar() {
            return this.chars[Math.floor(Math.random() * this.chars.length)];
        }

        scrambleMultiple(elements, options = {}) {
            const {
                interval = 200,
                duration = 1000,
                random = false
            } = options;

            this.queue = [...elements];
            if (random) this.shuffle(this.queue);

            const processQueue = () => {
                if (this.queue.length === 0) return;

                const element = this.queue.shift();
                this.scramble(element, duration).then(() => {
                    if (this.queue.length > 0) {
                        this.frameRequest = setTimeout(processQueue, interval);
                    }
                });
            };

            processQueue();
        }

        shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        stop() {
            cancelAnimationFrame(this.frame);
            clearTimeout(this.frameRequest);
            this.queue = [];
        }

        startAnimations(selector, options = {}) {
            const elements = document.querySelectorAll(selector);
            this.scrambleMultiple(elements, options);
        }
    }


    // Create an instance of TextScramble
    const textScramble = new TextScramble();

    // Start the animations when the page loads
    window.addEventListener('load', () => {
        textScramble.startAnimations('.scramble-text', {
            interval: 100,  // 100ms between each element start
            duration: 500, // 0.5 second for each scramble effect
            random: true   // Animate in order (set to true for random order)
        });
    });
});


