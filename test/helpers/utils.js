module.exports = {
    delay: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}