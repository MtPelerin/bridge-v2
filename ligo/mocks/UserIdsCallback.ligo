#include "../common/Utils.ligo"
#include "../common/Types.ligo"

function main (const param : list(userIdResult); var _store : option(list(userIdResult))) : (list(operation) * option(list(userIdResult))) is (noOperations, Some (param))


