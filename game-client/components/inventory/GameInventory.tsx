'use client';

import { useState } from 'react';
import { useNFTInventory } from '@/hooks/useNFTInventory';
import { useLockedNFT } from '@/lib/context/LockedNFTContext';
import { useBlockchain } from '@/lib/context/BlockchainContext';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import NFTModal from './NFTModal';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Web3 from 'web3';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS_NFT_MINTER, CONTRACT_ADDRESS_MINTER } from '@/lib/contracts/contract-config';
import { CONTRACT_ABI_NFT_MINTER } from '@/lib/contracts/abi/nft_minter';
import { CONTRACT_ABI_MINTER } from '@/lib/contracts/abi/token_minter';

interface GameInventoryProps {
  onNFTClick: (nft: any) => void;
}

export default function GameInventory({ onNFTClick }: GameInventoryProps) {
  const { tokenIds, metadata, isLoading, error } = useNFTInventory();
  const { isNFTLocked, getUnlockTime } = useLockedNFT();
  const { mintTokens } = useBlockchain();
  const { getEthersProvider } = usePrivy();
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedNFTForSale, setSelectedNFTForSale] = useState<string | null>(null);
  const [isSelling, setIsSelling] = useState(false);

  const formatTimeLeft = (unlocksAt: number) => {
    const now = Date.now();
    const timeLeft = Math.max(0, unlocksAt - now);
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleNFTClick = (tokenId: string) => {
    const nft = metadata[tokenId];
    if (!isNFTLocked(tokenId)) {
      onNFTClick(nft);
    }
    setSelectedTokenId(tokenId);
  };

  const calculatePrice = (skill: number) => {
    const basePrice = 250 + (skill * 10);
    return Math.min(400, basePrice);
  };

  const handleSellNFT = async (tokenId: string, price: number) => {
    if (isSelling) return;
    
    try {
      setIsSelling(true);
      
      // Get the signer
      const provider = await getEthersProvider();
      const web3 = new Web3(provider.provider);
      const signer = provider.getSigner();
      
      // Get contract instances
      const nftContract = new ethers.Contract(
        CONTRACT_ADDRESS_NFT_MINTER,
        CONTRACT_ABI_NFT_MINTER,
        signer
      );
      
      const auraContract = new ethers.Contract(
        CONTRACT_ADDRESS_MINTER,
        CONTRACT_ABI_MINTER,
        signer
      );

      // First burn the NFT
      const burnTx = await nftContract.burn(tokenId);
      await burnTx.wait();

      // Then mint AURA tokens to user's address
      const mintTx = await auraContract.mint(
        await signer.getAddress(),
        price.toString()
      );
      await mintTx.wait();
      
      // Show success message
      toast.success(`Successfully sold NFT for ${price} AURA!`, {
        description: `NFT burned and ${price} AURA minted to your wallet`,
      });

      // Reset states and refresh inventory
      setSelectedNFTForSale(null);
      window.location.reload(); // Refresh to update inventory
      
    } catch (error) {
      console.error('Error selling NFT:', error);
      toast.error('Failed to sell NFT', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSelling(false);
    }
  };

  const renderInventoryContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full px-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="p-0">
                <Skeleton className="w-full aspect-square rounded-t-xl" />
              </div>
              <div className="p-2">
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-red-400 text-center p-4 bg-red-900/20 rounded-lg border border-red-800">
          {error}
        </div>
      );
    }

    const items = tokenIds.map((tokenId) => {
      const nft = metadata[tokenId];
      console.log(nft);
      if (!nft) return null;

      const isLocked = isNFTLocked(tokenId);
      const unlockTime = getUnlockTime(tokenId);

      return {
        title: "",
        description: (
          <div 
            className={cn(
              "group flex flex-col items-center bg-black/40 rounded-xl overflow-hidden border transition-all cursor-pointer aspect-square",
              isLocked ? "border-red-800/50" : "border-gray-800/50 hover:border-purple-500/50"
            )}
            onClick={() => handleNFTClick(tokenId)}
          >
            <div className="w-full relative flex-1">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
              <Image
                src={nft.image}
                alt={nft.name}
                fill
                className={cn(
                  "object-cover transition-all",
                  isLocked ? "opacity-40 saturate-50" : "group-hover:scale-105"
                )}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
              />
              {isLocked && unlockTime && (
                <>
                  <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/80 px-2 py-1 rounded-full text-white z-30">
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="text-xs font-medium">{formatTimeLeft(unlockTime)}</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <svg 
                      className="w-20 h-20 text-red-500/50" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                  </div>
                </>
              )}
            </div>
            <div className="w-full p-2 flex justify-between items-center bg-black/40 relative z-20">
              <h3 className="text-sm font-medium text-gray-100 group-hover:text-white">
                {nft.name}
              </h3>
              <Badge 
                variant="secondary" 
                className={cn(
                  isLocked ? "bg-red-500/20 text-red-300" : "bg-purple-500/20 text-purple-300 group-hover:bg-purple-500/30",
                  "transition-colors duration-200"
                )}
              >
                {isLocked ? "Locked" : `Aura: ${nft.skill}`}
              </Badge>
            </div>
          </div>
        ),
        link: "#",
      };
    }).filter(Boolean) as { title: string; description: React.ReactNode; link: string }[];

    // Calculate rows needed to show 2 items per column
    const rows = Math.ceil(items.length / 3);
    const itemsPerColumn = 2;
    const columns = 3;

    return (
      <div className="w-full px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 auto-rows-min gap-4">
            {Array.from({ length: Math.min(rows * columns, items.length) }).map((_, index) => {
              const item = items[index];
              if (!item) return null;
              return (
                <div key={index} className="h-[200px]">
                  {item.description}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMarketplaceContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full px-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="p-0">
                <Skeleton className="w-full aspect-square rounded-t-xl" />
              </div>
              <div className="p-2">
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-red-400 text-center p-4 bg-red-900/20 rounded-lg border border-red-800">
          {error}
        </div>
      );
    }

    const items = tokenIds.map((tokenId) => {
      const nft = metadata[tokenId];
      if (!nft || isNFTLocked(tokenId)) return null;

      const salePrice = calculatePrice(nft.skill);

      return {
        title: "",
        description: (
          <div 
            className={cn(
              "group flex flex-col items-center bg-black/40 rounded-xl overflow-hidden border transition-all cursor-pointer aspect-square",
              "border-gray-800/50 hover:border-purple-500/50"
            )}
          >
            <div className="w-full relative flex-1">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
              <Image
                src={nft.image}
                alt={nft.name}
                fill
                className="object-cover transition-all group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
              />
              {selectedNFTForSale === tokenId && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                  <div className="text-center">
                    <p className="text-white mb-4">Sell for {salePrice} AURA?</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleSellNFT(tokenId, salePrice)}
                        disabled={isSelling}
                        className={cn(
                          "px-4 py-2 rounded-lg text-white",
                          isSelling 
                            ? "bg-purple-600/50 cursor-not-allowed" 
                            : "bg-purple-600 hover:bg-purple-700"
                        )}
                      >
                        {isSelling ? "Selling..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setSelectedNFTForSale(null)}
                        disabled={isSelling}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-800 rounded-lg text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="w-full p-2 flex flex-col gap-2 bg-black/40 relative z-20">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-100 group-hover:text-white">
                  {nft.name}
                </h3>
                <Badge 
                  variant="secondary" 
                  className="bg-purple-500/20 text-purple-300 group-hover:bg-purple-500/30 transition-colors duration-200"
                >
                  Aura: {nft.skill}
                </Badge>
              </div>
              <button
                onClick={() => setSelectedNFTForSale(tokenId)}
                disabled={isSelling}
                className={cn(
                  "w-full px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2",
                  isSelling 
                    ? "bg-purple-500/10 text-purple-300/50 cursor-not-allowed" 
                    : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                )}
              >
                <span>Sell for {salePrice} AURA</span>
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                  />
                </svg>
              </button>
            </div>
          </div>
        ),
        link: "#",
      };
    }).filter(Boolean) as { title: string; description: React.ReactNode; link: string }[];

    return (
      <div className="w-full px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 auto-rows-min gap-4">
            {Array.from({ length: Math.min(items.length) }).map((_, index) => {
              const item = items[index];
              if (!item) return null;
              return (
                <div key={index} className="h-[200px]">
                  {item.description}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-4">
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-gray-900/50 border border-gray-800 rounded-xl mb-6">
          <TabsTrigger 
            value="inventory" 
            className="data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-lg"
          >
            Inventory
          </TabsTrigger>
          <TabsTrigger 
            value="chatbot"
            className="data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-lg"
          >
            Chatbot
          </TabsTrigger>
          <TabsTrigger 
            value="marketplace"
            className="data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-lg"
          >
            Marketplace
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="w-full">
          <ScrollArea className="h-[calc(100vh-14rem)] w-full">
            {renderInventoryContent()}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="chatbot" className="w-full">
          <div className="text-center p-8 text-gray-400">
            Chatbot interface coming soon...
          </div>
        </TabsContent>
        <TabsContent value="marketplace" className="w-full">
          <ScrollArea className="h-[calc(100vh-14rem)] w-full">
            {renderMarketplaceContent()}
          </ScrollArea>
        </TabsContent>
      </Tabs>
      {selectedTokenId && (
        <NFTModal
          tokenId={selectedTokenId}
          metadata={metadata[selectedTokenId]}
          onClose={() => setSelectedTokenId(null)}
        />
      )}
    </div>
  );
}
