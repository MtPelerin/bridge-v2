#include "../common/Utils.ligo"
#include "../common/Types.ligo"

function main (const param : userIdAttributesResult; var _store : option(userIdAttributesResult)) : (list(operation) * option(userIdAttributesResult)) is (noOperations, Some (param))


