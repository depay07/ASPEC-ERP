// js/modules/print.js - 인쇄 기능 모듈

const PrintModule = {
    
    /**
     * 문서 인쇄
     */
    async print(tab, dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        const isPO = (tab === 'purchase_orders');
        
        // 주소 행 표시/숨김 (견적서는 주소 숨김)
        const addrRow1 = document.getElementById('print_row_addr_1');
        const addrRow2 = document.getElementById('print_row_addr_2');
        
        if (tab === 'quotes') {
            if (addrRow1) addrRow1.style.display = 'none';
            if (addrRow2) addrRow2.style.display = 'none';
        } else {
            if (addrRow1) addrRow1.style.display = 'table-row';
            if (addrRow2) addrRow2.style.display = 'table-row';
        }
        
        // 제목 설정
        const titles = {
            quotes: { ko: '견적서', en: 'QUOTATION', prefix: 'Q' },
            orders: { ko: '주문서', en: 'ORDER SHEET', prefix: 'D' },
            sales: { ko: '거래명세서', en: 'TRANSACTION STATEMENT', prefix: 'T' },
            purchase_orders: { ko: '발주서', en: 'PURCHASE ORDER', prefix: 'P' }
        };
        
        const titleInfo = titles[tab] || titles.sales;
        
        document.getElementById('p_title_ko').innerText = titleInfo.ko;
        document.getElementById('p_title_en').innerText = titleInfo.en;
        document.getElementById('p_date').innerText = row.date;
        
        // 문서번호 생성
        if (isPO && row.po_number && row.po_number.startsWith('ASPEC')) {
            document.getElementById('p_no').innerText = row.po_number;
        } else {
            const { count } = await supabaseClient
                .from(tab)
                .select('*', { count: 'exact', head: true })
                .eq('date', row.date)
                .lte('id', row.id);
            
            const d = new Date(row.date);
            const yymmdd = d.getFullYear().toString().slice(2) + 
                          String(d.getMonth() + 1).padStart(2, '0') + 
                          String(d.getDate()).padStart(2, '0');
            
            document.getElementById('p_no').innerText = `ASPEC-${yymmdd}-${titleInfo.prefix}${String(count).padStart(2, '0')}`;
        }
        
        // 거래처/공급자 정보 설정
        if (isPO) {
            document.getElementById('p_left_role').innerText = "수 주 처";
            document.getElementById('p_right_role').innerText = "발 주 처";
        } else {
            document.getElementById('p_left_role').innerText = "공 급 받 는 자";
            document.getElementById('p_right_role').innerText = "공 급 자";
        }
        
        document.getElementById('p_left_name').innerText = row.partner_name;
        document.getElementById('p_left_manager').innerText = row.partner_manager || '';
        document.getElementById('p_left_email').innerText = row.email || '';
        document.getElementById('p_left_phone').innerText = row.phone || '';
        document.getElementById('p_left_addr').innerText = row.partner_address || '';
        
        document.getElementById('p_right_name').innerText = "아스펙 (ASPEC)";
        document.getElementById('p_right_manager').innerText = "이창현 프로";
        document.getElementById('p_right_email').innerText = AppState.currentUserEmail;
        document.getElementById('p_right_mp').innerText = "010-5919-1810";
        
        // 품목 테이블 재구성
        this.buildItemsTable(row);
        
        // 인쇄 실행
        document.getElementById('printContainer').classList.remove('hidden');
        setTimeout(() => {
            window.print();
            document.getElementById('printContainer').classList.add('hidden');
        }, 100);
    },
    
    /**
     * 품목 테이블 구성
     */
    buildItemsTable(row) {
        const tableContainer = document.querySelector('.print-items-table');
        
        tableContainer.innerHTML = `
            <colgroup>
                <col style="width: 5%;">
                <col style="width: 25%;">
                <col style="width: 30%;">
                <col style="width: 8%;">
                <col style="width: 8%;">
                <col style="width: 12%;">
                <col style="width: 12%;">
            </colgroup>
            <thead>
                <tr>
                    <th>No</th><th>품명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>공급가액</th>
                </tr>
            </thead>
            <tbody id="p_tbody"></tbody>
            <tfoot>
                <tr style="background: #f8f8f8;">
                    <td colspan="4" style="text-align: center; border-right: 1px solid black; font-weight: bold;">합 계 (Total)</td>
                    <td style="text-align: center; border-right: 1px solid black; font-weight: bold;" id="p_total_qty"></td>
                    <td style="text-align: right; border-right: 1px solid black; font-size: 11px;">공급가액</td>
                    <td style="text-align: right; font-weight: bold;" id="p_sum_supply"></td>
                </tr>
                <tr>
                    <td colspan="5" style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                    <td style="text-align: right; border-right: 1px solid black; background: #f8f8f8; font-size: 11px;">부가세 (VAT)</td>
                    <td style="text-align: right;" id="p_sum_vat"></td>
                </tr>
                <tr style="font-weight: bold;">
                    <td colspan="5" style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                    <td style="text-align: right; border-right: 1px solid black; background: #e6e6e6;">총 합계</td>
                    <td style="text-align: right; background: #e6e6e6;" id="p_total_amt"></td>
                </tr>
                <tr style="background: #fff; border-top: 2px double black;">
                    <td colspan="7" style="padding: 10px; text-align: left;">
                        <strong>[비고]</strong> <span id="p_note"></span>
                    </td>
                </tr>
            </tfoot>`;
        
        const tbody = document.getElementById('p_tbody');
        let sumQty = 0, sumAmt = 0;
        
        if (row.items) {
            row.items.forEach((item, idx) => {
                let spec = item.spec;
                if (!spec) {
                    const prod = AppState.productList.find(p => p.name === item.name);
                    if (prod) spec = prod.spec;
                }
                
                sumQty += parseInt(item.qty) || 0;
                sumAmt += parseInt(item.supply) || 0;
                
                tbody.innerHTML += `
                    <tr class="items-row">
                        <td style="text-align:center">${idx + 1}</td>
                        <td>${item.name}</td>
                        <td style="font-size:10px">${spec || '-'}</td>
                        <td style="text-align:center">${item.unit || 'EA'}</td>
                        <td style="text-align:center">${item.qty}</td>
                        <td style="text-align:right">${formatNumber(item.price)}</td>
                        <td style="text-align:right">${formatNumber(item.supply)}</td>
                    </tr>`;
            });
        }
        
        // 빈 행 추가 (최소 10행)
        const emptyRows = 10 - (row.items?.length || 0);
        for (let i = 0; i < emptyRows; i++) {
            tbody.innerHTML += `<tr class="items-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
        }
        
        const vatAmt = Math.floor(sumAmt * 0.1);
        const totalAmt = row.total_amount || (sumAmt + vatAmt);
        
        document.getElementById('p_total_qty').innerText = formatNumber(sumQty);
        document.getElementById('p_sum_supply').innerText = formatNumber(sumAmt);
        document.getElementById('p_sum_vat').innerText = formatNumber(vatAmt);
        document.getElementById('p_total_amt').innerText = "₩ " + formatNumber(totalAmt);
        document.getElementById('p_note').innerText = row.note || '';
    }
};

// 전역 함수 연결
function printDocument(tab, dataId) {
    PrintModule.print(tab, dataId);
}
