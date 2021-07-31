#include "../common/Utils.ligo"
#include "../common/Types.ligo"

function main (const param : userIdResult; var _store : option(userIdResult)) : (list(operation) * option(userIdResult)) is (noOperations, Some (param))


