require('chai/register-should');

module.exports = {
    shouldFail: async (operation, error) => {
        try {
            await operation
        } catch (e) {
            e.message.should.equal(error);
        }
    }
}