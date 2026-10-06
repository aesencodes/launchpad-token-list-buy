// Generated from technical-brief/abi/LaunchFactory.json — do not edit by hand.
// Regenerate with: node scripts/generate-abis.mjs

export const launchFactoryAbi = [
  {
    "type": "function",
    "name": "canLaunch",
    "inputs": [
      {
        "name": "launcher",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createGraduatedPool",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "positionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getLaunchConfig",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct LaunchFactory.LaunchConfig",
        "components": [
          {
            "name": "supply",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "curveFeeBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "phantomQuote",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "graduationThreshold",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "poolFee",
            "type": "uint24",
            "internalType": "uint24"
          },
          {
            "name": "tickSpacing",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "enabled",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLaunchedToken",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ILaunchFactory.LaunchedToken",
        "components": [
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "curve",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "deployer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creatorFeeRecipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "pairToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "graduationThreshold",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "poolFee",
            "type": "uint24",
            "internalType": "uint24"
          },
          {
            "name": "tickSpacing",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "creatorTaxBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "buybackEnabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "phase",
            "type": "uint8",
            "internalType": "enum GraduationPhase"
          },
          {
            "name": "sweptQuote",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sweptTokens",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sweptAt",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "exists",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "launchConfigCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "launchFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "launchToken",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct LaunchFactory.TokenParams",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "symbol",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "logo",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "socials",
            "type": "tuple",
            "internalType": "struct LauncherToken.Socials",
            "components": [
              {
                "name": "twitter",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "telegram",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "discord",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "website",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "farcaster",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "creatorFeeRecipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creatorTaxBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "buybackEnabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "expectedEconomics",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "salt",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "launchConfigId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "pairToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "snipeTaxExemptions",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "curve",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "launchToken",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct LaunchFactory.TokenParams",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "symbol",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "logo",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "socials",
            "type": "tuple",
            "internalType": "struct LauncherToken.Socials",
            "components": [
              {
                "name": "twitter",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "telegram",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "discord",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "website",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "farcaster",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "creatorFeeRecipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creatorTaxBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "buybackEnabled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "expectedEconomics",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "salt",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "launchConfigId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "pairToken",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "curve",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "previewLaunchEconomics",
    "inputs": [
      {
        "name": "launchConfigId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "pairToken",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "TokenLaunched",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "curve",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "deployer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "pairToken",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "launchConfigId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "graduationThreshold",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadySet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CombinedFeeTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CoreLpFeeMustBeZero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CreatorTaxTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CurveFeeTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CurveNotQuotable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExemptionListTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeTransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GraduationExecutorNotSet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GraduationRescueTooEarly",
    "inputs": [
      {
        "name": "availableAt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "GraduationSeedNotViable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GraduationStillViable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InexactTransfer",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "expected",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "received",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidBasisPoints",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidGraduationThreshold",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidLaunchConfigId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPhantomQuote",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSnipeTaxWindow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTickSpacing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTokenParams",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LaunchConfigDisabled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LaunchDependenciesNotWired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LaunchDeployerNotSet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LaunchEconomicsMismatch",
    "inputs": [
      {
        "name": "expected",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "actual",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "LaunchFeeNotPaid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoPendingChange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotBuybackController",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotCreatorFeeRecipient",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotLaunchForwarder",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotReadyToGraduate",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotWhitelisted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToGraduate",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnershipCannotBeRenounced",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PairTokenDecimalsMismatch",
    "inputs": [
      {
        "name": "expected",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "actual",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "PairTokenDecimalsUnavailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PairTokenEconomicsInvalid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PairTokenNotApproved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PairTokenValidationFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SqrtPriceOutOfBounds",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SupplyTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SupplyTooLow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TimelockExpired",
    "inputs": [
      {
        "name": "expiresAt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "TimelockNotElapsed",
    "inputs": [
      {
        "name": "effectiveAt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "TokenNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnsupportedPrice",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WrongGraduationPhase",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  }
] as const;
