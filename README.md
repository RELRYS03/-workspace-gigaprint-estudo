# Oficina de enfeites 3D

Projeto independente em português para estudar um editor paramétrico de enfeites. Usa JavaScript, Canvas 2D, Web Workers e Vite.

## Executar

Requer Node.js 20.19+ ou 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

Abra o endereço informado pelo Vite. O editor também abre com o fragmento `#ornament`.

## Como o código funciona

1. **app.js** lê o formulário, valida os números e rasteriza texto, desenhos ou imagens em uma máscara. A prévia Canvas projeta a geometria em cinco vistas. Arraste horizontalmente para mudar o ângulo.
2. **geometry.js** amostra a silhueta, o padrão da malha e o desenho em uma grade. Cada célula indica material, borda, pino ou espaço vazio. O campo de altura representa a curva usada na prévia e nas peças do molde.
3. **worker.js** recebe uma cópia dos parâmetros e da máscara. A exportação roda em segundo plano para manter o formulário responsivo.
4. **export.js** percorre a grade tridimensional e emite triângulos nas faces externas de cada material. O 3MF empacota o XML do modelo, materiais e posições das peças num ZIP.
5. **geometry.test.js** verifica limites, silhuetas, remoção de faces internas e a estrutura do 3MF.

## Escopo e critérios

O HTML público do GigaPrint serviu de referência para os cinco grupos de controles e para valores iniciais como bola de 80 mm e folga de 0,3 mm. A interface, as máscaras, a projeção e a malha foram implementadas aqui. O editor de referência falhou na inicialização do WebGL durante a inspeção, e o cenário REA não chegou aos controles.

| Fluxo | Critério local |
| --- | --- |
| Forma e tamanho | Renderizar a forma selecionada; rejeitar tamanho personalizado vazio ou fora de 40–150 mm. |
| Prévia | Refletir entradas e alternar entre as cinco vistas. |
| Desenho | Aceitar texto e imagem local; indicar imagem ausente ou inválida. |
| Exportação | Baixar 3MF com unidades em milímetros, malhas para as peças e materiais separados. |
| Celular | Exibir o formulário sem rolagem horizontal a 390 px. |

Os padrões e as opções de desenhos foram selecionados para o estudo. A geometria é discretizada em uma grade, a prévia é uma projeção em Canvas e o 3MF usa materiais do padrão aberto. A compatibilidade com fatiadores específicos, o encaixe após impressão e a equivalência com a geometria do GigaPrint ainda precisam de verificação. Sem executar o editor de referência ou comparar seus arquivos, não há estimativa de cobertura.
