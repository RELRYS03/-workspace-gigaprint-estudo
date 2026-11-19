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

## Editor de malhas

Abra **Editor de malhas** para criar um cubo, cilindro ou esfera, ou importar um STL ou 3MF. No gerador de enfeites, **Editar peças** leva as malhas geradas direto ao editor. Selecione uma peça ou a cena inteira para redimensionar, cortar ou exportar. As cópias aparecem ao lado da peça de origem. O corte pode manter os dois lados ou apenas um deles.

**mesh.js** lê e grava malhas e aplica a escala aos vértices. **solid.js** usa Manifold (WebAssembly) para criar sólidos e fechar as faces do corte. **mesh-editor.js** controla a seleção, a prévia e o histórico de desfazer. A prévia usa amostragem para modelos grandes. A exportação usa todos os triângulos.

O corte exige uma malha fechada e orientada. A importação 3MF lê as malhas e instâncias da mesa com suas transformações. O 3MF exportado inclui a geometria e uma cor por objeto. Perfis de fatiamento, texturas, cores por triângulo e suportes do arquivo de origem ficam fora do novo arquivo. A edição atua sobre a malha triangulada e inclui escala e corte plano.

## Bancada de enfeites

Os controles ficam no painel esquerdo e a prévia ocupa a área central. Use **3D**, **Frente**, **Topo** ou **Lado** para trocar a câmera. Arraste sobre o modelo para girá-lo e use a roda para ajustar o zoom. **Arame**, **IDs** e **Ref. escala** alternam informações da prévia. No celular, a prévia vem antes do formulário.

A impressora selecionada define a grade da mesa e a verificação de tamanho. O aviso avalia se cada peça cabe individualmente com a margem indicada. A visualização da mesa não otimiza o posicionamento das peças nem substitui o fatiador. O download ZIP inclui o 3MF colorido e um STL por peça.

### Molde e disco da bola

Na opção **Bola**, o molde macho tem um ressalto e a fêmea tem uma cavidade aberta com fundo de 4 mm. Os dois usam perfis complementares. A abertura da fêmea considera a espessura do disco, o modo de desenho elevado e a folga configurada. A vista **Molde** mostra as peças separadas na orientação de impressão, enquanto **Enfeite + molde** ilustra a montagem antes da prensagem.

O disco da bola é plano. Suas barras, aro e alça são construídos com contornos vetoriais extrudados. O desenho é recortado para evitar ilhas soltas. Os testes verificam a cavidade, o encaixe geométrico sem interseção e a continuidade das barras e do aro. Impressão, aquecimento e encaixe físico ainda precisam ser testados.
