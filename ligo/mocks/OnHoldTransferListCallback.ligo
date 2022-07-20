#include "../common/Utils.ligo"
#include "../common/Types.ligo"

function main (const param : list (onhold_transfer); var _store : option(list(onhold_transfer))) : (list(operation) * option(list(onhold_transfer))) is (noOperations, Some (param))


