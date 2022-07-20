#include "../common/Utils.ligo"

function main (const param : string; var _store : option(string)) : (list(operation) * option(string)) is (noOperations, Some (param))


