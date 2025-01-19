# portfolio

## Prerequisites
> How did I set up this project on my Mac?

### python
```bash
brew install pyenv pyenv-virtualenv

pyenv install 3.13.1
pyenv local 3.13.1

pyenv virtualenv 3.13.1 portfolio
pyenv activate portfolio
pyenv local portfolio

# added to ~/.zshrc:
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
```

### npm
it was already installed - will have to update this part

## Getting Started
```bash
cd playground
PYTHONPATH=$(pwd)/.. python __main__.py  # or run via IDE

cd playground-dashboard
npm install
npm install vite --save-dev
npm run dev
```


