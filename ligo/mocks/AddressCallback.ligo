#include "../common/Utils.ligo"

function main (const param : address; var _store : option(address)) : (list(operation) * option(address)) is (noOperations, Some (param))


