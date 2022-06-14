#include "../common/Utils.ligo"
#include "../common/Types.ligo"

type entry_action is
| TransferIsTransferValidCb of isTransferValidResponse
| TransferBeforeTransferHookCb of isTransferValidResponse
| Other of unit

function main (const action : entry_action; var _store : option(isTransferValidResponse)): (list(operation) * option(isTransferValidResponse)) is
  case action of
 | TransferIsTransferValidCb(param) -> (noOperations, Some (param))
 | TransferBeforeTransferHookCb(param) -> (noOperations, Some (param))
 | Other(_param) -> (noOperations, (None : option(isTransferValidResponse)))
 end



