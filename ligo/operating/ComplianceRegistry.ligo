#include "../access/Roles.ligo"
#include "../common/Utils.ligo"
#include "../common/Keys.ligo"
#include "../common/Types.ligo"

const one_day = 86_400;
const one_month = 31 * one_day; // Approximation that a month last 31 days (not a problem for what we do)
const one_year = 12 * one_month;
const month_in_year : set(int) = set [0;1;2;3;45;6;7;8;9;10;11];

const transfer_invalid = -1;
const transfer_onhold = 0;
const transfer_approve = 1;
const transfer_reject = 2;
const transfer_cancel = 3;

const user_valid_until_key = 0;

type userCountParam is record
  callback_: contract(int);
  trustedIntermediary_: address;
end;

type userIdParam is record
  address_: address;
  callback_: contract(userIdResult);
  trustedIntermediaries_: list(address);
end;

type userIdsParam is record
  addresses_: list(address);
  callback_: contract(list(userIdResult));
  trustedIntermediaries_: list(address);
end;

type attributeParam is record
  callback_: contract(nat);
  key_: int;
  trustedIntermediary_: address;
  userId_: int;
end;

type validUntilParam is record
  callback_: contract(nat);
  trustedIntermediary_: address;
  userId_: int;
end;

type attributesParam is record  
  callback_: contract(list(nat));
  keys_: list(int);
  trustedIntermediary_: address;
  userId_: int;
end;

type isValidParam is record
  callback_: contract(bool);
  trustedIntermediary_: address;
  userId_: int;
end;

type isAddressValidParam is record
  address_: address;
  callback_: contract(bool);
  trustedIntermediaries_: list(address);
end;

type registerUserParam is record
  address_: address;
  attributeKeys_: list(int);
  attributeValues_: list(nat);
end;

type registerUsersParam is record
  addresses_: list(address);
  attributeKeys_: list(int);
  attributeValues_: list(nat);
end;

type attachAddressParam is record
  address_: address;
  userId_: int;
end;

type attachAddressesParam is record
  addresses_: list(address);
  userIds_: list(int);
end;

type updateUserAttributesParam is record
  attributeKeys_: list(int);
  attributeValues_: list(nat);
  userId_: int;
end;

type updateUsersAttributesParam is record
  attributeKeys_: list(int);
  attributeValues_: list(nat);
  userIds_: list(int);
end;

type xlyTransfersParam is record
  address_: address;
  callback_: contract(nat);
  realm_: address;
  trustedIntermediaries_: list(address);
end;

type getOnHoldTransfersParam is record
  callback_: contract(list(onhold_transfer));
  trustedIntermediary_: address;
end;

type processOnHoldTransferParam is record
  amountInRefCurrency_: nat;
  realm_: address;
  skipMinBoundaryUpdate_: bool;
  transferDecision_: int;
  transferId_: int;
end;

type cancelOnHoldTransferParam is record
  skipMinBoundaryUpdate_: bool;
  transferId_: int;
  trustedIntermediary_: address;
end;

type entry_action is 
 | TransferOwnership of address
 | RevokeOwnership
 | IsOperator of isRoleParam
 | AddOperator of address
 | RemoveOperator of address
 | UserCount of userCountParam
 | UserId of userIdParam
 | UserIds of userIdsParam
 | Attribute of attributeParam
 | AttributeForAddress of attributeForAddressParam
 | AttributeForAddresses of attributeForAddressesParam
 | ValidUntil of validUntilParam
 | Attributes of attributesParam
 | AttributesForAddress of attributesForAddressParam
 | AttributesForAddresses of attributesForAddressesParam
 | AttributesTransfersForAddresses of attributesTransfersForAddressesParam
 | IsValid of isValidParam
 | IsAddressValid of isAddressValidParam
 | IsAddressesValid of isAddressesValidParam
 | RegisterUser of registerUserParam
 | RegisterUsers of registerUsersParam
 | AttachAddress of attachAddressParam
 | AttachAddresses of attachAddressesParam
 | DetachAddress of address
 | DetachAddresses of list(address)
 | UpdateUserAttributes of updateUserAttributesParam
 | UpdateUsersAttributes of updateUsersAttributesParam
 | UpdateTransfers of updateTransfersParam
 | MonthlyTransfers of xlyTransfersParam
 | YearlyTransfers of xlyTransfersParam
 | MonthlyInTransfers of xlyTransfersParam
 | MonthlyOutTransfers of xlyTransfersParam
 | YearlyInTransfers of xlyTransfersParam
 | YearlyOutTransfers of xlyTransfersParam
 | AddOnHoldTransfer of addOnHoldTransferParam
 | GetOnHoldTransfers of getOnHoldTransfersParam
 | ProcessOnHoldTransfer of processOnHoldTransferParam
 | UpdateOnHoldMinBoundary of int
 | CancelOnHoldTransfer of cancelOnHoldTransferParam

type monthly_transfer is record
  in_ : nat;
  out_: nat;
end;

type monthly_transfers is map(int, monthly_transfer);

type user_attributes is map(int,nat);
type user_addresses is list(address);

type trusted_intermediary_state is record
  onHoldMinBoundary: int;
  onHoldMaxBoundary: int;
  userCount: int;
end;

const invalid_onhold_transfer : onhold_transfer = record [
  id_ = -1;
  amount_ = 0n;
  decision_ = transfer_invalid;
  from_ = burn_address;
  to_ = burn_address;
  token_ = burn_address;
]

const default_trusted_intermediary_state : trusted_intermediary_state = record [
  onHoldMinBoundary = 0;
  onHoldMaxBoundary = 0;
  userCount = 0;
];

const default_user_attributes : user_attributes = (map [] : map(int, nat));

const default_monthly_transfers : monthly_transfers = (map [] : map(int, monthly_transfer));
const default_monthly_transfer : monthly_transfer = record [
  in_ = 0n;
  out_ = 0n;
];

type user_attributes_map is map(bytes,user_attributes);
type address_transfers_map is map(bytes,monthly_transfers);
type address_users_map is big_map(bytes, int);
type onhold_transfers_map is big_map(bytes,onhold_transfer);
type trusted_intermediary_state_map is big_map(address,trusted_intermediary_state);
type user_addresses_map is map(bytes,user_addresses);

type state is record
  addressTransfers: address_transfers_map;
  addressUsers: address_users_map;
  onHoldTransfers: onhold_transfers_map;
  owner: address;
  roles: roles;
  trustedIntermediaries: trusted_intermediary_state_map;
  userAttributes: user_attributes_map;
  userAddresses: user_addresses_map;
end;

function _zero_list(const initial: list(int)) : list(nat) is block {
  function zero(const _i : int) : nat is 0n;
} with List.map(zero, initial);

function _remove_address_from_list(const address_list_ : list(address); const addressToRemove_ : address) : list(address) is
  block {
    function addressIterator (var acc: list(address); const address_: address) : list(address) is
      block {
        if address_ =/= addressToRemove_ then
          acc := address_ # acc;
        else skip;
      } with (acc)
  } with List.fold(addressIterator, address_list_, emptyAddressList);

function _getMonth(const offset: int) : int is 
  block {
    (* Dirty hack to get month number as int because computation is timestamp is very limited *)
    var y := 0;
    var m := 0;
    while ("1970-01-01T00:00:00.000Z":timestamp) + (y * one_year) < Tezos.now block {
      y := y+1;
    };
    y := y -1;
    while ("1970-01-01T00:00:00.000Z":timestamp) + (y * one_year) + (m * one_month) < Tezos.now block {
      m := m+1;
    };
    const month = y * 12 + m - 1 - offset;
  } with (month);

function _userId(const self: state; const trustedIntermediaries_ : list(address); const address_ : address) : userIdResult is
  block {
    const not_found : userIdResult = record [
      userId = 0;
      trustedIntermediary = burn_address;
    ];
    function find (const previouslyFound : userIdResult; const trustedIntermediary: address) is 
      block {
        var found : userIdResult := previouslyFound;
        if previouslyFound.userId = 0 then block {
          const addressKey_: bytes = _keyWithAddress(trustedIntermediary, address_);
          found := case self.addressUsers[addressKey_] of 
            | Some(_userId) -> block {
                const foundForUser : userIdResult = if _userId > 0 then record[userId = _userId;trustedIntermediary = trustedIntermediary;] else not_found;
              } with (foundForUser)
            | None -> not_found
            end;
        } else skip;
      } with (found);

    const found : userIdResult = List.fold(find, trustedIntermediaries_, not_found);
  } with (found);

function _attribute(const self: state; const trustedIntermediary_: address; const userId_: int; const key_: int) : nat is
  block {
    const default_attribute = 0n;
    const userKey_: bytes = _keyWithInt(trustedIntermediary_, userId_);
    var attribute_ : nat := case self.userAttributes[userKey_] of 
      | Some(userAttributes) -> block {
        const attributeInUserAttributes : nat = case userAttributes[key_] of 
          | None -> default_attribute 
          | Some(x) -> x
        end;
        } with (attributeInUserAttributes)
      | None -> default_attribute
    end;
  } with (attribute_);

function _attributes(const self: state; const trustedIntermediary_: address; const userId_: int; const keys_: list(int)) : list(nat) is
  block {
    const zero_list_ : list(nat) = _zero_list(keys_);
    const userKey_: bytes = _keyWithInt(trustedIntermediary_, userId_);
    var attributes_ : list(nat) := case self.userAttributes[userKey_] of 
      | Some(userAttributes) -> block {
          function addAttribute (const key_: int; const acc: list(nat)) : list(nat) is block {
            const attribute_ : nat = case userAttributes[key_] of | None -> 0n | Some(x) -> x end;
          } with (attribute_ # acc);
        } with List.fold_right(addAttribute, keys_, emptyNatList)
      | None -> zero_list_
    end;
  } with (attributes_);

function _isValid(const self : state; const trustedIntermediary_: address; const userId_ : int) : bool is 
  block {
    const isValid_ = (("1970-01-01T00:00:00Z" : timestamp) + int(_attribute(self, trustedIntermediary_, userId_, user_valid_until_key)))  > Tezos.now;
  } with (isValid_);

function _isAddressRegistered(const self: state; const trustedIntermediary_ : address; const address_ : address) : bool is 
  block {
    var trustedIntermediaries_ : list(address) := list [trustedIntermediary_];
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
    const isAddressRegistered_ : bool = userIdResult_.userId > 0;
  } with (isAddressRegistered_);

function _updateUserAttributes(var self : state; const userId_ : int; const attributeKeys_ : list(int); var attributeValues_: list(nat)) : state is
  block {
    const userKey_: bytes = _keyWithInt(Tezos.sender, userId_);
    function keysIterator(var acc: (user_attributes_map * list(nat)); const key_ : int) : (user_attributes_map * list(nat)) is
      block {
        var userAttributes_: user_attributes := case acc.0[userKey_] of | None -> default_user_attributes | Some(x) -> x end;
        const value_ : nat = case List.head_opt(acc.1) of | None -> 0n | Some(x) -> x end;
        userAttributes_[key_] := value_;
        acc.1 := case List.tail_opt(acc.1) of | None -> (list [] : list(nat)) | Some(x) -> x end;
        acc.0[userKey_] := userAttributes_;
      } with (acc);
    const result : (user_attributes_map * list(nat)) = List.fold(keysIterator, attributeKeys_, (self.userAttributes, attributeValues_));
    self.userAttributes := result.0;
  } with (self);

function _userCount(const self: state; const trustedIntermediary_ : address) : int is
  block {
    const trustedIntermediaryState_ : trusted_intermediary_state = case self.trustedIntermediaries[trustedIntermediary_] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const userCount_ : int = trustedIntermediaryState_.userCount;
  } with (userCount_);

function _registerUser(var self: state; const address_ : address; const attributeKeys_ : list(int); const attributeValues_: list(nat)) : state is 
  block {
    var trustedIntermediaryState_ : trusted_intermediary_state := case self.trustedIntermediaries[Tezos.sender] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    var userId_ : int := trustedIntermediaryState_.userCount + 1;
    const userKey_ : bytes = _keyWithInt(Tezos.sender, userId_);
    const addressKey_ : bytes = _keyWithAddress(Tezos.sender, address_);
    self := _updateUserAttributes(self, userId_, attributeKeys_, attributeValues_);
    self.addressUsers[addressKey_] := userId_;
    var userAddresses := case self.userAddresses[userKey_] of | None -> (list [] : list(address)) | Some(x) -> x end;
    self.userAddresses[userKey_] := address_ # userAddresses;
    trustedIntermediaryState_.userCount := userId_;
    self.trustedIntermediaries[Tezos.sender] := trustedIntermediaryState_;
  } with (self);

function _attachAddress(var self: state; const userId_ : int; const address_ : address) : state is
  block {
    const userKey_ : bytes = _keyWithInt(Tezos.sender, userId_);
    const addressKey_ : bytes = _keyWithAddress(Tezos.sender, address_);
    const existingUserId_ : int = case self.addressUsers[addressKey_] of | None -> 0 | Some(x) -> x end;
    require(existingUserId_ = 0, "UR02");
    self.addressUsers[addressKey_] := userId_;
    var userAddresses_ : list(address)  := case self.userAddresses[userKey_] of | None -> (list [] : list(address)) | Some(x) -> x end;
    self.userAddresses[userKey_] := address_ # userAddresses_;
  } with (self);

function _detachAddress(var self: state; const address_ : address) : state is 
  block {
    const addressKey_ : bytes = _keyWithAddress(Tezos.sender, address_);
    const existingUserId_ : int = case self.addressUsers[addressKey_] of | None -> 0 | Some(x) -> x end;
    require(existingUserId_ > 0, "UR04");
    const addressKey_: bytes = _keyWithAddress(Tezos.sender, address_);
    remove addressKey_ from map self.addressUsers;
    const existingUserKey_ = _keyWithInt(Tezos.sender, existingUserId_);
    var userAddresses_ : list(address)  := case self.userAddresses[existingUserKey_] of | None -> (list [] : list(address)) | Some(x) -> x end;
    self.userAddresses[existingUserKey_] := _remove_address_from_list(userAddresses_, address_); 
  } with (self);

function _monthlyInTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address) : nat is 
  block {
    var amount_ : nat := 0n;
    const month_ : int = _getMonth(0);
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
    if userIdResult_.userId = 0 then block {
      const addressKey_: bytes = _keyWithAddress(realm_, address_);
      const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
      const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_] of | None -> default_monthly_transfer | Some(x) -> x end;
      amount_ := monthlyTransfer_.in_;
    } else block {
      const userKey_ : bytes = _keyWithInt(userIdResult_.trustedIntermediary, userIdResult_.userId);
      const userAddresses_ : list(address) = case self.userAddresses[userKey_] of | None -> emptyAddressList | Some(x) -> x end;
      function addressIterator(var acc : nat; const userAddress_ : address) : nat is 
        block {
          const addressKey_ : bytes = _keyWithAddress(realm_, userAddress_);
          const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
          const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_] of | None -> default_monthly_transfer | Some(x) -> x end;
          acc := acc + monthlyTransfer_.in_;
        } with (acc);
      amount_ := List.fold(addressIterator, userAddresses_, amount_);
    };
  } with (amount_);

function _monthlyOutTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address) : nat is 
  block {
    var amount_ : nat := 0n;
    const month_ : int = _getMonth(0);
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
    if userIdResult_.userId = 0 then block {
      const addressKey_: bytes = _keyWithAddress(realm_, address_);
      const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
      const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_] of | None -> default_monthly_transfer | Some(x) -> x end;
      amount_ := monthlyTransfer_.out_;
    } else block {
      const userKey_ : bytes = _keyWithInt(userIdResult_.trustedIntermediary, userIdResult_.userId);
      const userAddresses_ : list(address) = case self.userAddresses[userKey_] of | None -> emptyAddressList | Some(x) -> x end;
      function addressIterator(var acc : nat; const userAddress_ : address) : nat is 
        block {
          const addressKey_: bytes = _keyWithAddress(realm_, userAddress_);
          const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
          const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_] of | None -> default_monthly_transfer | Some(x) -> x end;
          acc := acc + monthlyTransfer_.out_;
        } with (acc);
      amount_ := List.fold(addressIterator, userAddresses_, amount_);
    };
  } with (amount_);

function _yearlyInTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address) : nat is 
  block {
    var amount_ : nat := 0n;
    const month_ : int = _getMonth(0);
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
    if userIdResult_.userId = 0 then block {
      const addressKey_: bytes = _keyWithAddress(realm_, address_);
      const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
      // monthIterator is used because for loop is not accepted by Michelson type checker
      function monthIterator(var acc : nat; const i : int) : nat is
        block {
          const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_ - i] of | None -> default_monthly_transfer | Some(x) -> x end;
          acc := acc + monthlyTransfer_.in_;
        } with (acc);
      amount_ := Set.fold(monthIterator, month_in_year, 0n);
    } else block {
      const userKey_ : bytes = _keyWithInt(userIdResult_.trustedIntermediary, userIdResult_.userId);
      const userAddresses_ : list(address) = case self.userAddresses[userKey_] of | None -> emptyAddressList | Some(x) -> x end;
      function addressIterator(var acc : nat; const userAddress_ : address) : nat is 
        block {
          const addressKey_: bytes = _keyWithAddress(realm_, userAddress_);
          const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
          // monthIterator is used because for loop is not accepted by Michelson type checker
          function monthIterator(var acc : nat; const i : int) : nat is
            block {
              const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_ - i] of | None -> default_monthly_transfer | Some(x) -> x end;
              acc := acc + monthlyTransfer_.in_;
            } with (acc);
          acc := acc + Set.fold(monthIterator, month_in_year, 0n);
        } with (acc);
      amount_ := List.fold(addressIterator, userAddresses_, 0n);
    };
  } with (amount_);

function _yearlyOutTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address) : nat is 
  block {
    var amount_ : nat := 0n;
    const month_ : int = _getMonth(0);
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
    if userIdResult_.userId = 0 then block {
      const addressKey_: bytes = _keyWithAddress(realm_, address_);
      const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
      // monthIterator is used because for loop is not accepted by Michelson type checker
      function monthIterator(var acc : nat; const i : int) : nat is
        block {
          const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_ - i] of | None -> default_monthly_transfer | Some(x) -> x end;
          acc := acc + monthlyTransfer_.out_;
        } with (acc);
      amount_ := Set.fold(monthIterator, month_in_year, 0n);
    } else block {
      const userKey_ : bytes = _keyWithInt(userIdResult_.trustedIntermediary, userIdResult_.userId);
      const userAddresses_ : list(address) = case self.userAddresses[userKey_] of | None -> emptyAddressList | Some(x) -> x end;
      function addressIterator(var acc : nat; const userAddress_ : address) : nat is 
        block {
          const addressKey_: bytes = _keyWithAddress(realm_, userAddress_);
          const monthlyTransfers_: monthly_transfers = case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
          // monthIterator is used because for loop is not accepted by Michelson type checker
          function monthIterator(var acc : nat; const i : int) : nat is
            block {
              const monthlyTransfer_: monthly_transfer = case monthlyTransfers_[month_ - i] of | None -> default_monthly_transfer | Some(x) -> x end;
              acc := acc + monthlyTransfer_.out_;
            } with (acc);
          acc := acc + Set.fold(monthIterator, month_in_year, 0n);
        } with (acc);
      amount_ := List.fold(addressIterator, userAddresses_, 0n);
    };
  } with (amount_);

function _updateTransfers(var self: state; const realm_ : address; const from_ : address; const to_ : address; const value_ : nat) : state is
  block {
    const month_ : int = _getMonth(0);
    if from_ =/= Tezos.self_address and to_ =/= Tezos.self_address then block {
      if from_ =/= burn_address then block {
        const addressKey_: bytes = _keyWithAddress(realm_, from_);
        var monthlyTransfers : monthly_transfers := case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
        var monthlyTransfer : monthly_transfer := case monthlyTransfers[month_] of | None -> default_monthly_transfer | Some(x) -> x end;
        patch monthlyTransfer with record [out_ = monthlyTransfer.out_ + value_];
        monthlyTransfers[month_] := monthlyTransfer;
        self.addressTransfers[addressKey_] := monthlyTransfers;
      } else skip;
      if to_ =/= burn_address then block {
        const addressKey_: bytes = _keyWithAddress(realm_, to_);
        var monthlyTransfers : monthly_transfers := case self.addressTransfers[addressKey_] of | None -> default_monthly_transfers | Some(x) -> x end;
        var monthlyTransfer : monthly_transfer := case monthlyTransfers[month_] of | None -> default_monthly_transfer | Some(x) -> x end;
        patch monthlyTransfer with record [in_ = monthlyTransfer.in_ + value_];
        monthlyTransfers[month_] := monthlyTransfer;
        self.addressTransfers[addressKey_] := monthlyTransfers;
      } else skip;
    }
    else skip;
  } with (self);

function _approveOnHoldTransfer(var self: state; const transferId_ : int; var onHoldTransfer_ : onhold_transfer; const realm_: address; const amountInRefCurrency_: nat) : (list (operation) * state) is 
  block {
    self := _updateTransfers(self, realm_, onHoldTransfer_.from_, onHoldTransfer_.to_, amountInRefCurrency_);
    const transferKey_ = _keyWithInt(Tezos.sender, transferId_);
    onHoldTransfer_.decision_ := transfer_approve;
    self.onHoldTransfers[transferKey_] := onHoldTransfer_;
    const contract_ : contract(transfer) = case (Tezos.get_entrypoint_opt("%transfer", onHoldTransfer_.token_) : option(contract(transfer))) of | None -> failwith("UR08") | Some(x) -> x end;
    const param_ : transfer = record [
      from_ = Tezos.self_address;
      to_ = onHoldTransfer_.to_;
      amount_ = onHoldTransfer_.amount_;
    ];
    const op = Tezos.transaction(param_, 0tez, contract_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function _rejectOnHoldTransfer(var self: state; const transferId_ : int; var onHoldTransfer_ : onhold_transfer) : (list (operation) * state) is 
  block {
    const transferKey_ = _keyWithInt(Tezos.sender, transferId_);
    onHoldTransfer_.decision_ := transfer_reject;
    self.onHoldTransfers[transferKey_] := onHoldTransfer_;
    const contract_ : contract(transfer) = case (Tezos.get_entrypoint_opt("%transfer", onHoldTransfer_.token_) : option(contract(transfer))) of | None -> failwith("UR08") | Some(x) -> x end;
    const param_ : transfer = record [
      from_ = Tezos.self_address;
      to_ = onHoldTransfer_.from_;
      amount_ = onHoldTransfer_.amount_;
    ];
    const op = Tezos.transaction(param_, 0tez, contract_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function _cancelOnHoldTransfer(var self: state; const trustedIntermediary_: address; const transferId_ : int; var onHoldTransfer_ : onhold_transfer) : (list (operation) * state) is 
  block {
    const transferKey_ = _keyWithInt(trustedIntermediary_, transferId_);
    onHoldTransfer_.decision_ := transfer_cancel;
    self.onHoldTransfers[transferKey_] := onHoldTransfer_;
    const contract_ : contract(transfer) = case (Tezos.get_entrypoint_opt("%transfer", onHoldTransfer_.token_) : option(contract(transfer))) of | None -> failwith("UR08") | Some(x) -> x end;
    const param_ : transfer = record [
      from_ = Tezos.self_address;
      to_ = onHoldTransfer_.from_;
      amount_ = onHoldTransfer_.amount_;
    ];
    const op = Tezos.transaction(param_, 0tez, contract_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function _updateOnHoldMinBoundary(var self : state; const trustedIntermediary_ : address; var minBoundary_ : int; const maxBoundary_ : int) : state is 
  block {
    var trustedIntermediaryState_ : trusted_intermediary_state := case self.trustedIntermediaries[trustedIntermediary_] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    var transferIds_ : set(int) := set [];
    for i := minBoundary_ to maxBoundary_ - 1 block {
      transferIds_ := Set.add(i, transferIds_);
    };
    const onHoldTransfers_ : onhold_transfers_map = self.onHoldTransfers;
    function transferIterator(var acc : (bool * int); const transferId_ : int) : (bool * int) is
      block {
        if acc.0 = False then block {
          const transferKey_: bytes = _keyWithInt(trustedIntermediary_, transferId_);
          const transfer_ : onhold_transfer = case onHoldTransfers_[transferKey_] of | None -> invalid_onhold_transfer | Some(x) -> x end;
          if transfer_.decision_ =/= transfer_onhold then
            acc.1 := acc.1 + 1;
          else acc.0 := True;
        } else skip;
      } with (acc);
    const result : (bool * int) = Set.fold(transferIterator, transferIds_, (False, minBoundary_));
    trustedIntermediaryState_.onHoldMinBoundary := result.1;
    self.trustedIntermediaries[trustedIntermediary_] := trustedIntermediaryState_;
  } with (self);


// Access control functions
function failIfNotOwnerOrOperator(const self: state) : (unit) is
  block {
    require(self.owner = Tezos.sender or ROLES.hasRole(self.roles, "operator", Tezos.sender), "OP01");
  } with (unit);

function failIfNotOwner(const owner: address) : (unit) is
  block {
    require(owner = Tezos.sender, "AD01");
  } with (unit);

function transferOwnership (var self : state; const new_owner : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.owner := new_owner;
  } with (noOperations, self);

function revokeOwnership (var self : state) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.owner := burn_address;
  } with (noOperations, self);

function isOperator (const self: state; const operator_ : address; const callback : contract(bool)) : (list(operation) * state) is
  block {
    const value = ROLES.hasRole(self.roles, "operator", operator_);
    const op : operation = Tezos.transaction(value, 0tez, callback);
    const ops : list (operation) = list [op]
  } with (ops, self);

function addOperator (var self : state; const operator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.roles := ROLES.addRole(self.roles, "operator", operator_);
  } with (noOperations, self);

function removeOperator (var self : state; const operator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.roles := ROLES.removeRole(self.roles, "operator", operator_);
  } with (noOperations, self);

function userCount(const self: state; const trustedIntermediary_ : address; const callback_ : contract(int)) : list(operation) is
  block {
    var trustedIntermediaryState_ : trusted_intermediary_state := case self.trustedIntermediaries[trustedIntermediary_] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const op : operation = Tezos.transaction(trustedIntermediaryState_.userCount, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function userId(const self: state; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(userIdResult)) : list(operation) is
  block {
    const found : userIdResult = _userId(self, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(found, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function userIds(const self: state; const trustedIntermediaries_ : list(address); const addresses_ : list(address); const callback_: contract(list(userIdResult))): list(operation) is
  block {
    function addressIterator(const address_: address; var acc: list(userIdResult)) : list(userIdResult) is 
      block {
        const found : userIdResult = _userId(self, trustedIntermediaries_, address_);
        acc := found # acc;
      } with (acc);
    const result: list(userIdResult) = List.fold_right(addressIterator, addresses_, (list [] : list (userIdResult)));
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function attribute(const self: state; const trustedIntermediary_: address; const userId_: int; const key_: int; const callback_: contract(nat)) : list(operation) is
  block {
    const attribute_ : nat = _attribute(self, trustedIntermediary_, userId_, key_);
    const op : operation = Tezos.transaction(attribute_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function attributeForAddress(const self: state; const trustedIntermediaries_ : list(address); const address_ : address; const key_: int; const callback_: contract(userIdAttributeResult)) : list(operation) is
  block {
    const found : userIdResult = _userId(self, trustedIntermediaries_, address_);
    var attribute_ : nat := 0n;
    if found.userId > 0 then attribute_ := _attribute(self, found.trustedIntermediary, found.userId, key_);
    else skip;
    const op : operation = Tezos.transaction(record[userIdResult = found; attribute = attribute_], 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function attributeForAddresses(const self: state; const trustedIntermediaries_ : list(address); const addresses_ : list(address); const key_: int; const callback_: contract(list(userIdAttributeResult))) : list(operation) is
  block {
    function addressIterator(const address_: address; var acc: list(userIdAttributeResult)) : list(userIdAttributeResult) is 
      block {
        const found : userIdResult = _userId(self, trustedIntermediaries_, address_);
        var attribute_ : nat := 0n;
        if found.userId > 0 then attribute_ := _attribute(self, found.trustedIntermediary, found.userId, key_);
        else skip;
        acc := record[userIdResult = found; attribute = attribute_] # acc;
      } with (acc);
    const result: list(userIdAttributeResult) = List.fold_right(addressIterator, addresses_, (list [] : list (userIdAttributeResult)));
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function validUntil(const self: state; const trustedIntermediary_: address; const userId_: int; const callback_: contract(nat)) : list(operation) is attribute(self, trustedIntermediary_, userId_, user_valid_until_key, callback_);

function attributes(const self: state; const trustedIntermediary_: address; const userId_: int; const keys_: list(int); const callback_: contract(list(nat))) : list(operation) is
  block {
    const attributes_ = _attributes(self, trustedIntermediary_, userId_, keys_);
    const op : operation = Tezos.transaction(attributes_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function attributesForAddress(const self: state; const trustedIntermediaries_ : list(address); const address_ : address; const keys_: list(int); const callback_: contract(userIdAttributesResult)) : list(operation) is
  block {
    const found : userIdResult = _userId(self, trustedIntermediaries_, address_);
    var attributes_ : list(nat) := _zero_list(keys_);
    if found.userId > 0 then attributes_ := _attributes(self, found.trustedIntermediary, found.userId, keys_);
    else skip;
    const op : operation = Tezos.transaction(record[userIdResult = found; attributes = attributes_], 0tez, callback_);
    const ops : list (operation) = list [op]
} with ops

function attributesForAddresses(const self: state; const trustedIntermediaries_ : list(address); const addresses_ : list(address); const keys_: list(int); const callback_: contract(list(userIdAttributesResult))) : list(operation) is
  block {
    function addressIterator(const address_: address; var acc: list(userIdAttributesResult)) : list(userIdAttributesResult) is 
      block {
        const found : userIdResult = _userId(self, trustedIntermediaries_, address_);
        var attributes_ : list(nat) := _zero_list(keys_);
        if found.userId > 0 then attributes_ := _attributes(self, found.trustedIntermediary, found.userId, keys_);
        else skip;
        acc := record[userIdResult = found; attributes = attributes_] # acc;
      } with (acc);
    const result: list(userIdAttributesResult) = List.fold_right(addressIterator, addresses_, (list [] : list (userIdAttributesResult)));
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
} with ops

function attributesTransfersForAddresses(const self: state; const realm_: address; const trustedIntermediaries_ : list(address); const addresses_ : list(addressSide); const keys_: list(int); const callback_: contract(list(userIdAttributesTransfersResult))) : list(operation) is
  block {
    function addressIterator(const address_: addressSide; var acc: list(userIdAttributesTransfersResult)) : list(userIdAttributesTransfersResult) is 
      block {
        const found : userIdResult = _userId(self, trustedIntermediaries_, address_.address_);
        var attributes_ : list(nat) := _zero_list(keys_);
        if found.userId > 0 then attributes_ := _attributes(self, found.trustedIntermediary, found.userId, keys_);
        else skip;
        var monthly_: nat := 0n;
        var yearly_: nat := 0n;
        if address_.side_ = "in" then block {
          monthly_ := _monthlyInTransfers(self, realm_, trustedIntermediaries_, address_.address_);
          yearly_ := _yearlyInTransfers(self, realm_, trustedIntermediaries_, address_.address_);
        } else if address_.side_ = "out" then block {
          monthly_ := _monthlyOutTransfers(self, realm_, trustedIntermediaries_, address_.address_);
          yearly_ := _yearlyOutTransfers(self, realm_, trustedIntermediaries_, address_.address_);
        } else skip;
        acc := record[userIdResult = found; attributes = attributes_; monthly = monthly_; yearly = yearly_] # acc;
      } with (acc);
    const result: list(userIdAttributesTransfersResult) = List.fold_right(addressIterator, addresses_, (list [] : list (userIdAttributesTransfersResult)));
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
} with ops

function isValid(const self: state; const trustedIntermediary_: address; const userId_ : int; const callback_: contract(bool)) : list(operation) is 
  block {
    const isValid_ : bool = _isValid(self, trustedIntermediary_, userId_);
    const op : operation = Tezos.transaction(isValid_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function isAddressValid(const self: state; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(bool)) : list(operation) is
  block {
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
    var isValid_ : bool := False;
    if userIdResult_.userId > 0 then
      isValid_ := _isValid(self, userIdResult_.trustedIntermediary, userIdResult_.userId);
    else skip;
    const op : operation = Tezos.transaction(isValid_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function isAddressesValid(const self: state; const trustedIntermediaries_ : list(address); const addresses_ : list(address); const callback_ : contract(list(bool))) : list(operation) is
  block {
    function addressIterator(const address_: address; var acc: list(bool)) : list(bool) is 
      block {
        const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, address_);
        var isValid_ : bool := False;
        if userIdResult_.userId > 0 then
          isValid_ := _isValid(self, userIdResult_.trustedIntermediary, userIdResult_.userId);
        else skip;
        acc := isValid_ # acc;
      } with (acc);
    const result: list(bool) = List.fold_right(addressIterator, addresses_, (list [] : list (bool)));
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function registerUser(var self: state; const address_ : address; const attributeKeys_ : list(int); const attributeValues_: list(nat)) : (list (operation) * state) is 
  block {
    require(List.length(attributeKeys_) = List.length(attributeValues_), "UR05");
    require(_isAddressRegistered(self, Tezos.sender, address_) = False, "UR02");
    self := _registerUser(self, address_, attributeKeys_, attributeValues_);
  } with (noOperations, self);

function registerUsers(var self: state; const addresses_ : list(address); const attributeKeys_ : list(int); const attributeValues_: list(nat)) : (list (operation) * state) is 
  block {
    require(List.length(attributeKeys_) = List.length(attributeValues_), "UR05");
    function addressIterator (var acc : state; const address_: address) : state is 
      block {
        acc := _registerUser(acc, address_, attributeKeys_, attributeValues_);
      } with (acc);
  } with (noOperations, List.fold(addressIterator, addresses_, self));

function attachAddress(var self: state; const userId_ : int; const address_ : address): (list (operation) * state) is 
  block {
    require(userId_ > 0 and userId_ <= _userCount(self, Tezos.sender), "UR01");
    self := _attachAddress(self, userId_, address_);
  } with (noOperations, self);

function attachAddresses(var self : state; var userIds_ : list(int); const addresses_ : list(address)):  (list (operation) * state) is 
  block {
    require(List.length(userIds_) = List.length(addresses_), "UR03");
    const userCount_ = _userCount(self, Tezos.sender);
    function addressIterator (var acc: (state * list(int)); const address_ : address) : (state * list(int)) is
      block {
        const userId_ : int = case List.head_opt (acc.1) of | None -> 0 | Some(x) -> x end;
        require(userId_ > 0 and userId_ <= userCount_, "UR01");
        acc.0 := _attachAddress(acc.0, userId_, address_);
        acc.1 := case List.tail_opt(acc.1) of | None -> (list [] : list(int)) | Some(x) -> x end;
      } with (acc); 
    const result : (state * list(int)) = List.fold(addressIterator, addresses_, (self, userIds_));
  } with (noOperations, result.0);

function detachAddress(var self: state; const address_ : address) : (list (operation) * state) is 
  block {
   self := _detachAddress(self, address_);
  } with (noOperations, self);

function detachAddresses(var self : state; const addresses_ : list(address)) : (list (operation) * state) is 
  block {
    function addressIterator(var acc : state; const address_: address) : state is block {
      acc := _detachAddress(acc, address_);
    } with (acc);
  } with (noOperations, List.fold(addressIterator, addresses_, self));

function updateUserAttributes(var self : state; const userId_ : int; const attributeKeys_ : list(int); const attributeValues_ : list(nat)): (list (operation) * state) is
  block {
    require(List.length(attributeKeys_) = List.length(attributeValues_), "UR05");
    require(userId_ > 0 and userId_ <= _userCount(self, Tezos.sender), "UR01");
    self := _updateUserAttributes(self, userId_, attributeKeys_, attributeValues_);
  } with (noOperations, self);

function updateUsersAttributes(var self: state; const userIds_ : list(int); const attributeKeys_ : list(int); const attributeValues_ : list(nat)): (list (operation) * state) is
  block {
    const userCount_ = _userCount(self, Tezos.sender);
    function userIdIterator (var acc : state; const userId_ : int) : state is
      block {
        if userId_ > 0 and userId_ <= userCount_ then
          acc := _updateUserAttributes(acc, userId_, attributeKeys_, attributeValues_);
        else skip;
      } with(acc); 
  } with (noOperations, List.fold(userIdIterator, userIds_, self));

function updateTransfers(var self: state; const realm_ : address; const from_ : address; const to_ : address; const value_ : nat): (list (operation) * state) is
  block {
    failIfNotOwnerOrOperator(self);
    self := _updateTransfers(self, realm_, from_, to_, value_);
  } with(noOperations, self);

function monthlyTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(nat)) : list(operation) is 
  block {
    const monthlyTransfers_ : nat = _monthlyInTransfers(self, realm_, trustedIntermediaries_, address_) + _monthlyOutTransfers(self, realm_, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(monthlyTransfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function yearlyTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(nat)) : list(operation) is 
  block {
    const yearlyTransfers_ : nat = _yearlyInTransfers(self, realm_, trustedIntermediaries_, address_) + _yearlyOutTransfers(self, realm_, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(yearlyTransfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function monthlyInTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(nat)) : list(operation) is 
  block {
    const monthlyInTransfers_ : nat = _monthlyInTransfers(self, realm_, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(monthlyInTransfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function yearlyInTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(nat)) : list(operation) is 
  block {
    const yearlyInTransfers_ : nat = _yearlyInTransfers(self, realm_, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(yearlyInTransfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function monthlyOutTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(nat)) : list(operation) is 
  block {
    const monthlyOutTransfers_ : nat = _monthlyOutTransfers(self, realm_, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(monthlyOutTransfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function yearlyOutTransfers(const self: state; const realm_ : address; const trustedIntermediaries_ : list(address); const address_ : address; const callback_ : contract(nat)) : list(operation) is 
  block {
    const yearlyOutTransfers_ : nat = _yearlyOutTransfers(self, realm_, trustedIntermediaries_, address_);
    const op : operation = Tezos.transaction(yearlyOutTransfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function addOnHoldTransfer(var self: state; const trustedIntermediaries_ : list(address); const token_ : address; const from_ : address; const to_ : address; const amount_ : nat) : (list (operation) * state) is 
  block {
    failIfNotOwnerOrOperator(self);
    const userIdResult_ : userIdResult = _userId(self, trustedIntermediaries_, from_);
    require(userIdResult_.userId > 0, "SR01");
    const trustedIntermediary_ = userIdResult_.trustedIntermediary;
    var trustedIntermediaryState_ : trusted_intermediary_state := case self.trustedIntermediaries[trustedIntermediary_] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const maxBoundary: int = trustedIntermediaryState_.onHoldMaxBoundary;
    const transferKey_: bytes = _keyWithInt(trustedIntermediary_, maxBoundary);
    self.onHoldTransfers[transferKey_] := record [
      id_ = maxBoundary;
      amount_ = amount_;
      decision_ = transfer_onhold;
      from_ = from_;
      to_ = to_;
      token_ = token_;
    ];
    patch trustedIntermediaryState_ with record [onHoldMaxBoundary = maxBoundary + 1 ];
    self.trustedIntermediaries[trustedIntermediary_] := trustedIntermediaryState_;
  } with (noOperations, self);

function getOnHoldTransfers(const self: state; const trustedIntermediary_ : address; const callback_ : contract(list(onhold_transfer))) : list(operation) is
  block {
    const trustedIntermediaryState_ : trusted_intermediary_state = case self.trustedIntermediaries[trustedIntermediary_] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const minBoundary : int = trustedIntermediaryState_.onHoldMinBoundary;
    const maxBoundary : int = trustedIntermediaryState_.onHoldMaxBoundary;
    var transferIds_ : set(int) := set [];
    for i := minBoundary to maxBoundary - 1 block {
      transferIds_ := Set.add(i, transferIds_);
    };
    function transferIterator(var acc : list(onhold_transfer); const transferId_ : int) : list(onhold_transfer) is
      block {
        const transferKey_: bytes = _keyWithInt(trustedIntermediary_, transferId_);
        const transfer_ : onhold_transfer = case self.onHoldTransfers[transferKey_] of | None -> invalid_onhold_transfer | Some(x) -> x end;
        if transfer_.decision_ = transfer_onhold then
          acc := transfer_ # acc;
        else skip;
      } with (acc);
    const transfers_ = Set.fold(transferIterator, transferIds_, (list [] : list(onhold_transfer)));
    const op : operation = Tezos.transaction(transfers_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function processOnHoldTransfer(var self : state; const transferId_ : int; const transferDecision_ : int; const realm_: address; const amountInRefCurrency_ : nat; const skipMinBoundaryUpdate_ : bool): (list (operation) * state) is 
  block {
    const trustedIntermediaryState_ : trusted_intermediary_state = case self.trustedIntermediaries[Tezos.sender] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const minBoundary : int = trustedIntermediaryState_.onHoldMinBoundary;
    const maxBoundary : int = trustedIntermediaryState_.onHoldMaxBoundary;
    const transferKey_: bytes = _keyWithInt(Tezos.sender, transferId_);
    var ops : list (operation) := list [];
    if maxBoundary > minBoundary then block {
      const onHoldTransfer_ : onhold_transfer = case self.onHoldTransfers[transferKey_] of | None -> invalid_onhold_transfer | Some(x) -> x end;
      if onHoldTransfer_.decision_ = transfer_onhold then block {
        var result : (list (operation) * state) := (ops, self);
        if transferDecision_ = transfer_approve then block {
          result := _approveOnHoldTransfer(self, transferId_, onHoldTransfer_, realm_, amountInRefCurrency_);
        } else block { 
          result := _rejectOnHoldTransfer(self, transferId_, onHoldTransfer_);
        };
        ops := _merge_operation_lists(result.0, ops);
        self := result.1;
      } else skip;
      if skipMinBoundaryUpdate_ = False then
        self := _updateOnHoldMinBoundary(self, Tezos.sender, minBoundary, maxBoundary);
      else skip;
    }
    else skip;
  } with (ops, self);

function updateOnHoldMinBoundary(var self: state; const maxIterations_ : int) : (list (operation) * state) is 
  block {
    const trustedIntermediaryState_ : trusted_intermediary_state = case self.trustedIntermediaries[Tezos.sender] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const minBoundary : int = trustedIntermediaryState_.onHoldMinBoundary;
    var maxBoundary : int := trustedIntermediaryState_.onHoldMaxBoundary;
    if minBoundary + maxIterations_ < maxBoundary then block {
      maxBoundary := minBoundary + maxIterations_;
    } else skip;
    self := _updateOnHoldMinBoundary(self, Tezos.sender, minBoundary, maxBoundary);
  } with (noOperations, self);

function cancelOnHoldTransfer(var self : state; const trustedIntermediary_ : address; const transferId_ : int; const skipMinBoundaryUpdate_ : bool) : (list (operation) * state) is
  block {
    const trustedIntermediaryState_ : trusted_intermediary_state = case self.trustedIntermediaries[trustedIntermediary_] of | None -> default_trusted_intermediary_state | Some(x) -> x end;
    const minBoundary : int = trustedIntermediaryState_.onHoldMinBoundary;
    const maxBoundary : int = trustedIntermediaryState_.onHoldMaxBoundary;
    var ops : list (operation) := list [];
    if maxBoundary > minBoundary then block {
      const transferKey_: bytes = _keyWithInt(trustedIntermediary_, transferId_);
      const onHoldTransfer_ : onhold_transfer = case self.onHoldTransfers[transferKey_] of | None -> invalid_onhold_transfer | Some(x) -> x end;
      require(onHoldTransfer_.from_ = Tezos.sender, "UR07");
      const result : (list (operation) * state) = _cancelOnHoldTransfer(self, trustedIntermediary_, transferId_, onHoldTransfer_);
      self := result.1;
      ops := result.0;
      if skipMinBoundaryUpdate_ = False then block {
        self := _updateOnHoldMinBoundary(self, trustedIntermediary_, minBoundary, maxBoundary);
      } else skip;
    } else skip;
  } with (ops, self);

function main (const action : entry_action; const self : state): (list(operation) * state) is
  case action of
  | TransferOwnership(param) -> transferOwnership(self, param)
  | RevokeOwnership(_param) -> revokeOwnership(self)
  | IsOperator(param) -> isOperator(self, param.address_, param.callback_)
  | AddOperator(param) -> addOperator(self, param)
  | RemoveOperator(param) -> removeOperator(self, param)
  | UserCount(param) -> (userCount(self, param.trustedIntermediary_, param.callback_), self)
  | UserId(param) -> (userId(self, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | UserIds(param) -> (userIds(self, param.trustedIntermediaries_, param.addresses_, param.callback_), self)
  | Attribute(param) -> (attribute(self, param.trustedIntermediary_, param.userId_, param.key_, param.callback_), self)
  | AttributeForAddress(param) -> (attributeForAddress(self, param.trustedIntermediaries_, param.address_, param.key_, param.callback_), self)
  | AttributeForAddresses(param) -> (attributeForAddresses(self, param.trustedIntermediaries_, param.addresses_, param.key_, param.callback_), self)
  | ValidUntil(param) -> (validUntil(self, param.trustedIntermediary_, param.userId_, param.callback_), self)
  | Attributes(param) -> (attributes(self, param.trustedIntermediary_, param.userId_, param.keys_, param.callback_), self)
  | AttributesForAddress(param) -> (attributesForAddress(self, param.trustedIntermediaries_, param.address_, param.keys_, param.callback_), self)
  | AttributesForAddresses(param) -> (attributesForAddresses(self, param.trustedIntermediaries_, param.addresses_, param.keys_, param.callback_), self)
  | AttributesTransfersForAddresses(param) -> (attributesTransfersForAddresses(self, param.realm_, param.trustedIntermediaries_, param.addresses_, param.keys_, param.callback_), self)
  | IsValid(param) -> (isValid(self, param.trustedIntermediary_, param.userId_, param.callback_), self)
  | IsAddressValid(param) -> (isAddressValid(self, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | IsAddressesValid(param) -> (isAddressesValid(self, param.trustedIntermediaries_, param.addresses_, param.callback_), self)
  | RegisterUser(param) -> registerUser(self, param.address_, param.attributeKeys_, param.attributeValues_)
  | RegisterUsers(param) -> registerUsers(self, param.addresses_, param.attributeKeys_, param.attributeValues_)
  | AttachAddress(param) -> attachAddress(self, param.userId_, param.address_)
  | AttachAddresses(param) -> attachAddresses(self, param.userIds_, param.addresses_)
  | DetachAddress(param) -> detachAddress(self, param)
  | DetachAddresses(param) -> detachAddresses(self, param)
  | UpdateUserAttributes(param) -> updateUserAttributes(self, param.userId_, param.attributeKeys_, param.attributeValues_)
  | UpdateUsersAttributes(param) -> updateUsersAttributes(self, param.userIds_, param.attributeKeys_, param.attributeValues_)
  | UpdateTransfers(param) -> updateTransfers(self, param.realm_, param.from_, param.to_, param.value_)
  | MonthlyTransfers(param) -> (monthlyTransfers(self, param.realm_, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | YearlyTransfers(param) -> (yearlyTransfers(self, param.realm_, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | MonthlyInTransfers(param) -> (monthlyInTransfers(self, param.realm_, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | MonthlyOutTransfers(param) -> (monthlyOutTransfers(self, param.realm_, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | YearlyInTransfers(param) -> (yearlyInTransfers(self, param.realm_, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | YearlyOutTransfers(param) -> (yearlyOutTransfers(self, param.realm_, param.trustedIntermediaries_, param.address_, param.callback_), self)
  | AddOnHoldTransfer(param) -> addOnHoldTransfer(self, param.trustedIntermediaries_, param.token_, param.from_, param.to_, param.amount_)
  | GetOnHoldTransfers(param) -> (getOnHoldTransfers(self, param.trustedIntermediary_, param.callback_), self)
  | ProcessOnHoldTransfer(param) -> processOnHoldTransfer(self, param.transferId_, param.transferDecision_, param.realm_, param.amountInRefCurrency_, param.skipMinBoundaryUpdate_)
  | UpdateOnHoldMinBoundary(param) -> updateOnHoldMinBoundary(self, param)
  | CancelOnHoldTransfer(param) -> cancelOnHoldTransfer(self, param.trustedIntermediary_, param.transferId_, param.skipMinBoundaryUpdate_)
 end

