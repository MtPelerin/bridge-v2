## Abstract

The BRIDGE is designed to issue Security Tokens (tokens that represent ownership in an underlying asset). Unlike Utility Tokens for which transfer is most of the time not restricted, Security tokens are subject to transferability restrictions based on many factors (identity, asset class, local rules, transfer history, ...).

Most of the current (as of 2019-07-11) Security Token middleware used a Token based approach to the rule enforcement. This approach is a good step towards regulation but lacks a cross-token approach to be able to apply transfer restriction rules that are computed accross multiple tokens (Global transfer thresholds for example). 

The BRIDGE aims to provide a solution to this problem by being a cross-token compliance middleware that will restrict the transferability of an ERC20 compliant token based on a set of rules. Those rules are managed by the issuer that is able to set new rules whenever new regulations appear.

Moreover, for regulatory compliance, the BRIDGE provides features that would allow authorities to transfer tokens from one address to another in case of exceptional events (loss of keys, legal constraints, locked assets, ...)

## Audit

Contracts have been thoroughly audited by Chain Security: [Read the final report](https://chainsecurity.com/security-audit/mt-pelerin-bridge/)

## Overall overview

![Overall overview](docs/assets/overview.png "Overall overview")

## Bridge Token

The token part is the interface used by external parties to interact with the token through all its lifecycle (issue/redeem, approvals, transfers, ...). 

The token has a single owner, one or multiple administrators, one or multple issuers and one or multiple seizers.

As the BRIDGE aims to be as open as possible, the token issuer will have the opportunity to define trusted intermediaries that will act as the compliance authorities for this specific token. The role of the compliance authority is to maintain the Compliance Registry and make sure that the information stored in the compliance registry are accurate.

The token is registered with a Processor that will process all the operations centrally. Having a single Processor for all the tokens will ease the maintenance of the token lifecycle as it will not be necessary to upgrade all the tokens to be able to add new features or new restrictions to each token.

[Bridge Token API Overview](docs/api.md#bridgetoken)

## Processor

The Processor orchestrates all operations on tokens. For each transfer, the Processor will apply the rules configured on the token level and available through the Rule Engine and check if every rule allows the transfer.

[Processor API Overview](docs/api.md#processor)

## Rule Engine

The Rule Engine is a library of rules that can be used by the token issuer to restrict the token transferability. As regulations evolve, new rules will be added to the Rule Engine and the token issuer will be able to enforce them to adapt its compliance.

Trivial rules like maximum transfers or minimum transfers will not need to have interactions with other contracts. For more complex rules that need information about the identity linked to an address or the history of transfers linked to an address, two contract are currently provided, Compliance Registry and Price Oracle.

[Detailed Rule Engine Documentation](docs/RuleEngine.md)
[Rule Engine API Overview](docs/api.md#ruleengine)

## Compliance Registry

The Compliance Registry is responsible of the storage of all identity information linked to an address or the storage of the history of transfers linked to an address. The compliance registry is managed by trusted intermediaries. Each trusted intermediary has its own space within the registry to update its own address related information. Based on the token trusted intermediaries, the Compliance Registry will return the compliance information that have been updated by one of the token trusted intermediary.

> The Compliance Registry is designed to store only pseudo-anonymised data (no Customer Identification Data).

To be able to maintain a single reference currency for transfers history, the Compliance Registry will use the Price Oracle.

[Detailed Compliance Registry Documentation](docs/ComplianceRegistry.md)
[Compliance Registry API Overview](docs/api.md#complianceregistry)

## Price Oracle

The Price Oracle is responsible of providing exchange rates between the reference currency and the token price.

[Price Oracle API Overview](docs/api.md#priceoracle)

## Contract Diagram

![Architecture](docs/assets/architecture.png "Architecture")

## API

- [API](docs/api.md)