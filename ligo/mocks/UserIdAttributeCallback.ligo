#include "../common/Utils.ligo"
#include "../common/Types.ligo"

function main (const param : userIdAttributeResult; var _store : option(userIdAttributeResult)) : (list(operation) * option(userIdAttributeResult)) is (noOperations, Some (param))


