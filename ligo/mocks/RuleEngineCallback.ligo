#include "../common/Utils.ligo"
#include "../rules/common/Types.ligo"

type entry_action is
| IsTransferValidCb of isTransferValidResult
| Other of unit

function main (const action : entry_action; var _store : option(isTransferValidResult)): (list(operation) * option(isTransferValidResult)) is
  case action of
 | IsTransferValidCb(param) -> (noOperations, Some (param))
 | Other(_param) -> (noOperations, (None : option(isTransferValidResult)))
 end

