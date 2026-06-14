class Controls {
    constructor(type = 'KEYS') {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;

        if (type === 'KEYS' && typeof document !== 'undefined') {
            this.#addKeyboardListeners();
        } else if (type === 'DUMMY') {
            this.forward = true;
        }
    }

    #addKeyboardListeners() {
        document.onkeydown = (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                    this.left = true;
                    break;
                case 'ArrowRight':
                    this.right = true;
                    break;
                case 'ArrowUp':
                    this.forward = true;
                    break;
                case 'ArrowDown':
                    this.reverse = true;
                    break;
            }
        };
        document.onkeyup = (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                    this.left = false;
                    break;
                case 'ArrowRight':
                    this.right = false;
                    break;
                case 'ArrowUp':
                    this.forward = false;
                    break;
                case 'ArrowDown':
                    this.reverse = false;
                    break;
            }
        };
    }
}

class FakeControls {
    constructor() {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;
    }
}
