"use client";

import React from 'react';

export default function ETHPriceChart() {
    return (
        <div className="w-full h-[500px] bg-background border rounded-lg overflow-hidden">
            <iframe
                title="ETH Price Chart"
                style={{ width: "100%", height: "100%", border: "none" }}
                src="https://www.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=COINBASE%3AETHUSD&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=%5B%5D&theme=light&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en"
                allowTransparency={true}
                scrolling="no"
            />
        </div>
    );
}
