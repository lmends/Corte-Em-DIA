# Arquivo: pixqrcodegen.py (Sua classe, corrigida e adaptada)

import crcmod
import qrcode
import io
import base64

class Payload():
    def __init__(self, nome, chavepix, valor, cidade, txtId, diretorio=''):
        
        # Seus atributos originais, mantidos
        self.nome = nome
        self.chavepix = chavepix
        # Garantindo que o valor seja um float para cálculos
        self.valor = float(str(valor).replace(',', '.')) 
        self.cidade = cidade
        self.txtId = txtId
        
        # Mantendo a estrutura, mas corrigindo os cálculos
        nome_formatado = ''.join(c for c in self.nome if c.isalnum() or c.isspace()).upper()[:25]
        cidade_formatada = ''.join(c for c in self.cidade if c.isalnum() or c.isspace()).upper()[:15]
        valor_formatado = f"{self.valor:.2f}"

        merchant_account_info = f"0014BR.GOV.BCB.PIX01{len(self.chavepix):02d}{self.chavepix}"
        additional_data_field = f"05{len(self.txtId):02d}{self.txtId}"

        self.payloadFormat = '000201'
        self.merchantAccount = f'26{len(merchant_account_info):02d}{merchant_account_info}'
        self.merchantCategCode = '52040000'
        self.transactionCurrency = '5303986'
        self.transactionAmount = f'54{len(valor_formatado):02d}{valor_formatado}'
        self.countryCode = '5802BR'
        self.merchantName = f'59{len(nome_formatado):02d}{nome_formatado}'
        self.merchantCity = f'60{len(cidade_formatada):02d}{cidade_formatada}'
        self.addDataField = f'62{len(additional_data_field):02d}{additional_data_field}'
        self.crc16 = '6304'

    def gerarPayload(self):
        # Monta o payload parcial
        payload = f'{self.payloadFormat}{self.merchantAccount}{self.merchantCategCode}{self.transactionCurrency}{self.transactionAmount}{self.countryCode}{self.merchantName}{self.merchantCity}{self.addDataField}{self.crc16}'

        # Calcula o CRC16 e anexa
        payload_completo, crc_calculado = self._gerarCrc16(payload)
        
        # Gera o QR Code em memória
        buffer_imagem = self._gerarQrCode(payload_completo)

        # <--- MUDANÇA PRINCIPAL: RETORNANDO OS DADOS ---
        # Em vez de salvar arquivo, agora a função retorna o que precisamos
        return payload_completo, buffer_imagem

    def _gerarCrc16(self, payload):
        crc16 = crcmod.mkCrcFun(poly=0x11021, initCrc=0xFFFF, rev=False, xorOut=0x0000)
        crc16Code = hex(crc16(str(payload).encode('utf-8')))
        crc16Code_formatado = str(crc16Code).replace('0x', '').upper().zfill(4)
        return f'{payload}{crc16Code_formatado}', crc16Code_formatado

    def _gerarQrCode(self, payload):
        # <--- MUDANÇA IMPORTANTE: NÃO SALVA MAIS ARQUIVO ---
        # Gera o QR Code e o salva em um buffer de memória
        qr_img = qrcode.make(payload)
        buffered = io.BytesIO()
        qr_img.save(buffered, format="PNG")
        return buffered # Retorna o buffer com a imagem