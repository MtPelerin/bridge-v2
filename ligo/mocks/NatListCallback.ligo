#include "../common/Utils.ligo"

function main (const param : list (nat); var _store : option(list(nat))) : (list(operation) * option(list(nat))) is (noOperations, Some (param))


